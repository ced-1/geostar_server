var http = require('http');
var path = require('path');
var express = require('express');
var router = express();
var server = http.createServer(router);

//Liste des expression r�guli�re:

var regexcoord= /^([ ]*[+-]?\d{1,2}.\d+[ ]*[,;][ ]*[+-]?\d{1,3}.\d+[ ]*)$/; 		// expression detection de coordonnees
var regsplitlatlon=new RegExp("[,;]+", "g");										// expression decoupage des coordonnees


router.use(express.json()); // for parsing application/json
router.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

//router.use(express.static(path.resolve(__dirname, 'GeostarClient')));

//Capture la requ�te POST pour la traiter et renvoie un r�sultat

router.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  next();
});

router.post('/',function(req,res){
	res.setHeader('Content-Type', 'application/json');
	var liste= (req.body.elt);
	var dataresponse = new Array;
	for (var i=0;i<liste.length;i++){
		switch(checktype(liste[i].elt_id)){
			case 0:
				var lat_lon=setcoord(liste[i].elt_id);
				dataresponse.push({elt_id : liste[i].elt_id, lat : lat_lon[0], lon : lat_lon[1]});
		}
	}
	console.log(dataresponse)
	res.send(JSON.stringify(dataresponse));
});


//Fonction de v�rification du type d'un �l�ment

function checktype(elt){
	if(regexcoord.test(elt)){
		return 0
	}
};

function setcoord(elt){
	var tabcoord= elt.split(regsplitlatlon);
	return tabcoord;
};


server.listen(process.env.PORT || 8081, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Geostar server listening at", addr.address + ":" + addr.port);
});
