var globeRadius = 1000;
var vec3_origin = new THREE.Vector3(0,0,0);

/*
 * code derived from geopins.js
 */
function latLonToCenter(latitude, longitude) {
    var rad = 100;
    var lon = longitude - 90;
    var lat = latitude;
    
    var phi = Math.PI/2 - lat * Math.PI / 180 - Math.PI * 0.01;
    var theta = 2 * Math.PI - lon * Math.PI / 180 + Math.PI * 0.06;
	
	var center = new THREE.Vector3();                
    center.x = Math.sin(phi) * Math.cos(theta) * rad;
    center.y = Math.cos(phi) * rad;
    center.z = Math.sin(phi) * Math.sin(theta) * rad; 
    return center;
}

function makeConnectionLineGeometry( exporter, importer, value ){
	var distanceBetweenCountryCenter = exporter.center.clone().subSelf(importer.center).length();		

	//	start of the line
	var start = exporter.center;

	//	end of the line
	var end = importer.center;
	
	//	midpoint for the curve
	var mid = start.clone().lerpSelf(end,0.5);		
	var midLength = mid.length()
	mid.normalize();
	mid.multiplyScalar( midLength + Math.max(distanceBetweenCountryCenter * 0.7, 10) );			

	//	the normal from start to end
	var normal = (new THREE.Vector3()).sub(start,end);
	normal.normalize();

	/*				     
				The curve looks like this:
				
				midStartAnchor---- mid ----- midEndAnchor
			  /											  \
			 /											   \
			/												\
	start/anchor 										 end/anchor

		splineCurveA							splineCurveB
	*/

	var distanceHalf = distanceBetweenCountryCenter * 0.5;

	var startAnchor = start;
	var midStartAnchor = mid.clone().addSelf( normal.clone().multiplyScalar( distanceHalf ) );					
	var midEndAnchor = mid.clone().addSelf( normal.clone().multiplyScalar( -distanceHalf ) );
	var endAnchor = end;

	//	now make a bezier curve out of the above like so in the diagram
	var splineCurveA = new THREE.CubicBezierCurve3( start, startAnchor, midStartAnchor, mid);											
	// splineCurveA.updateArcLengths();

	var splineCurveB = new THREE.CubicBezierCurve3( mid, midEndAnchor, endAnchor, end);
	// splineCurveB.updateArcLengths();

	//	how many vertices do we want on this guy? this is for *each* side
	var vertexCountDesired = Math.floor( /*splineCurveA.getLength()*/ distanceBetweenCountryCenter * 0.02 + 6 ) * 2;	

	//	collect the vertices
	var points = splineCurveA.getPoints( vertexCountDesired );

	//	remove the very last point since it will be duplicated on the next half of the curve
	points = points.splice(0,points.length-1);

	points = points.concat( splineCurveB.getPoints( vertexCountDesired ) );

	//	add one final point to the center of the earth
	//	we need this for drawing multiple arcs, but piled into one geometry buffer
	points.push( vec3_origin );

	var val = value * 0.0003;
	
	var size = (10 + Math.sqrt(val));
	size = constrain(size,0.1, 60);

	//	create a line geometry out of these
	var curveGeometry = THREE.Curve.Utils.createLineGeometry( points );

	curveGeometry.size = size;

	return curveGeometry;
}

function constrain(v, min, max){
	if( v < min )
		v = min;
	else
	if( v > max )
		v = max;
	return v;
}