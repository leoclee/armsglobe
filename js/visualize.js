function addVisualizedMesh(path, parentTo) {
	if (path) {
		if (Array.isArray(path)) {
			path.forEach((e) => addVisualizedMesh(e, parentTo));
		} else {
			if (!path.from) {
				path.from = parentTo;
			}
			visualizationMesh.add(getVisualizedMesh(path));
		}
	}
}

function getVisualizedMesh( path ){
	var linesGeo = new THREE.Geometry();
	var lineColors = [];

	var particlesGeo = new THREE.Geometry();
	var particleColors = [];			

	var lineGeometry = makeConnectionLineGeometry( {center:latLonToCenter(path.from.lat, path.from.lng)}, {center:latLonToCenter(path.to.lat, path.to.lng)}, 8774800000 );
	var lineColor = path.color == null ? new THREE.Color(defaultColor) : new THREE.Color(path.color);
	var lastColor;
	//	grab the colors from the vertices
	for( s in lineGeometry.vertices ){
		var v = lineGeometry.vertices[s];		
		lineColors.push(lineColor);
		lastColor = lineColor;
	}

	//	merge it all together
	THREE.GeometryUtils.merge( linesGeo, lineGeometry );

	var particleColor = lastColor.clone();		
	var points = lineGeometry.vertices;
	var particleSize = lineGeometry.size;			
	var point = points[0];						
	var particle = point.clone();
	particle.moveIndex = 0;
	particle.nextIndex = 1;
	if(particle.nextIndex >= points.length )
		particle.nextIndex = 0;
	particle.lerpN = 0;
	particle.path = points;
	particlesGeo.vertices.push( particle );	
	particle.size = particleSize;
	particleColors.push( particleColor );						

	linesGeo.colors = lineColors;	

	//	make a final mesh out of this composite
	var splineOutline = new THREE.Line( linesGeo, new THREE.LineBasicMaterial( 
		{ 	color: 0xffffff, opacity: 1.0, blending: 
			THREE.AdditiveBlending, transparent:true, 
			depthWrite: false, vertexColors: true, 
			linewidth: 1 } ) 
	);

	splineOutline.renderDepth = false;


	attributes = {
		size: {	type: 'f', value: [] },
		customColor: { type: 'c', value: [] }
	};

	uniforms = {
		amplitude: { type: "f", value: 1.0 },
		color:     { type: "c", value: new THREE.Color( 0xffffff ) },
		texture:   { type: "t", value: 0, texture: THREE.ImageUtils.loadTexture( "images/particleA.png" ) },
	};

	var shaderMaterial = new THREE.ShaderMaterial( {

		uniforms: 		uniforms,
		attributes:     attributes,
		vertexShader:   document.getElementById( 'vertexshader' ).textContent,
		fragmentShader: document.getElementById( 'fragmentshader' ).textContent,

		blending: 		THREE.AdditiveBlending,
		depthTest: 		true,
		depthWrite: 	false,
		transparent:	true,
		// sizeAttenuation: true,
	});



	var particleGraphic = THREE.ImageUtils.loadTexture("images/map_mask.png");
	var particleMat = new THREE.ParticleBasicMaterial( { map: particleGraphic, color: 0xffffff, size: 60, 
														blending: THREE.NormalBlending, transparent:true, 
														depthWrite: false, vertexColors: true,
														sizeAttenuation: true } );
	particlesGeo.colors = particleColors;
	var pSystem = new THREE.ParticleSystem( particlesGeo, shaderMaterial );
	pSystem.path = path;
	pSystem.dynamic = true;
	splineOutline.add( pSystem );

	var vertices = pSystem.geometry.vertices;
	var values_size = attributes.size.value;
	var values_color = attributes.customColor.value;

	for( var v = 0; v < vertices.length; v++ ) {		
		values_size[ v ] = pSystem.geometry.vertices[v].size;
		values_color[ v ] = particleColors[v];
	}

	pSystem.update = function(){	
		// var time = Date.now()									
		for( var i in this.geometry.vertices ){						
			var particle = this.geometry.vertices[i];
			var path = particle.path;
			var moveLength = path.length;
			
			particle.lerpN += 0.5;
			if(particle.lerpN > 1){
				particle.lerpN = 0;
				particle.moveIndex = particle.nextIndex;
				particle.nextIndex++;
				this.parent.material.opacity = 2 * (1 - particle.moveIndex/path.length); // fade trace line after halfway point
				if( particle.nextIndex >= path.length ){
					addVisualizedMesh(this.path.next, this.path.to);
					visualizationMesh.remove(this.parent);
					this.parent.remove(this);
					break;
				}
			}

			var currentPoint = path[particle.moveIndex];
			var nextPoint = path[particle.nextIndex];
			

			particle.copy( currentPoint );
			particle.lerpSelf( nextPoint, particle.lerpN );			
		}
		this.geometry.verticesNeedUpdate = true;
	};		

	//	return this info as part of the mesh package, we'll use this in selectvisualization
	splineOutline.affectedCountries = [];

	splineOutline.visible = !hiddenCategories.has(path.category);
	THREE.SceneUtils.showHierarchy(splineOutline, splineOutline.visible); // hide yo kids
	return splineOutline;	
}

function selectVisualization( linearData, year, countries, exportCategories, importCategories ){
	//	we're only doing one country for now so...
	var cName = countries[0].toUpperCase();
	
	$("#hudButtons .countryTextInput").val(cName);
	previouslySelectedCountry = selectedCountry;
	selectedCountry = countryData[countries[0].toUpperCase()];
    
	selectedCountry.summary = {
		imported: {
			mil: 0,
			civ: 0,
			ammo: 0,
			total: 0,
		},
		exported: {
			mil: 0,
			civ: 0,
			ammo: 0,
			total: 0,
		},
		total: 0,
		historical: getHistoricalData(selectedCountry),
	};

	// console.log(selectedCountry);

	//	clear off the country's internally held color data we used from last highlight
	for( var i in countryData ){
		var country = countryData[i];
		country.exportedAmount = 0;
		country.importedAmount = 0;
		country.mapColor = 0;
	}

	//	clear markers
	for( var i in selectableCountries ){
		removeMarkerFromCountry( selectableCountries[i] );
	}

	//	clear children
	while( visualizationMesh.children.length > 0 ){
		var c = visualizationMesh.children[0];
		visualizationMesh.remove(c);
	}

	//	build the mesh
	console.time('getVisualizedMesh');
	var mesh = getVisualizedMesh( timeBins, year, countries, exportCategories, importCategories );				
	console.timeEnd('getVisualizedMesh');

	//	add it to scene graph
	visualizationMesh.add( mesh );	


	//	alright we got no data but at least highlight the country we've selected
	if( mesh.affectedCountries.length == 0 ){
		mesh.affectedCountries.push( cName );
	}	

	for( var i in mesh.affectedCountries ){
		var countryName = mesh.affectedCountries[i];
		var country = countryData[countryName];
		attachMarkerToCountry( countryName, country.mapColor );
	}

	// console.log( mesh.affectedCountries );
	highlightCountry( mesh.affectedCountries );

	if( previouslySelectedCountry !== selectedCountry ){
		if( selectedCountry ){
			rotateToLatLng(selectedCountry.lat, selectedCountry.lon);
		}	
	}
    
    d3Graphs.initGraphs();
}

function rotateToLatLng(lat, lng) {
	rotateTargetX = lat * Math.PI/180;
	var targetY0 = -(lng - 9) * Math.PI / 180;
	var piCounter = 0;
	while(true) {
		var targetY0Neg = targetY0 - Math.PI * 2 * piCounter;
		var targetY0Pos = targetY0 + Math.PI * 2 * piCounter;
		if(Math.abs(targetY0Neg - rotating.rotation.y) < Math.PI) {
			rotateTargetY = targetY0Neg;
			break;
		} else if(Math.abs(targetY0Pos - rotating.rotation.y) < Math.PI) {
			rotateTargetY = targetY0Pos;
			break;
		}
		piCounter++;
		rotateTargetY = wrap(targetY0, -Math.PI, Math.PI);
	}
	// console.log(rotateTargetY);
	//lines commented below source of rotation error
	//is there a more reliable way to ensure we don't rotate around the globe too much? 
	/*
	if( Math.abs(rotateTargetY - rotating.rotation.y) > Math.PI )
		rotateTargetY += Math.PI;		
	*/
	rotateVX *= 0.6;
	rotateVY *= 0.6;	
}