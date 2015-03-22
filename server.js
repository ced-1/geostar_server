var http = require('http');
var path = require('path');
var express = require('express');
var router = express();
var server = http.createServer(router);
var Promise = require('promise');
var mmdbreader = require('maxmind-db-reader');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var cities = mmdbreader.openSync('./GeoLite2-City.mmdb');	//BDD IP


//Liste des expression reguliere:

var regexcoord= /^([ ]*[+-]?\d{1,2}.\d+[ ]*[,;][ ]*[+-]?\d{1,3}.\d+[ ]*)$/; 		// expression detection de coordonnees
var regexip=/([0-9]{1,3}\.){3}([0-9]){1,3}|((([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){6}:[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){5}:([0-9A-Fa-f]{1,4}:)?[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){4}:([0-9A-Fa-f]{1,4}:){0,2}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){3}:([0-9A-Fa-f]{1,4}:){0,3}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){2}:([0-9A-Fa-f]{1,4}:){0,4}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){6}((b((25[0-5])|(1d{2})|(2[0-4]d)|(d{1,2}))b).){3}(b((25[0-5])|(1d{2})|(2[0-4]d)|(d{1,2}))b))|(([0-9A-Fa-f]{1,4}:){0,5}:((b((25[0-5])|(1d{2})|(2[0-4]d)|(d{1,2}))b).){3}(b((25[0-5])|(1d{2})|(2[0-4]d)|(d{1,2}))b))|(::([0-9A-Fa-f]{1,4}:){0,5}((b((25[0-5])|(1d{2})|(2[0-4]d)|(d{1,2}))b).){3}(b((25[0-5])|(1d{2})|(2[0-4]d)|(d{1,2}))b))|([0-9A-Fa-f]{1,4}::([0-9A-Fa-f]{1,4}:){0,5}[0-9A-Fa-f]{1,4})|(::([0-9A-Fa-f]{1,4}:){0,6}[0-9A-Fa-f]{1,4})|(([0-9A-Fa-f]{1,4}:){1,7}:))/
var regsplitlatlon=new RegExp("[,;]+", "g");										// expression decoupage des coordonnees


router.use(express.json()); // for parsing application/json
router.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

//Complete les entetes pour gerer l'interdomaine

router.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  next();
});

router.get('/test', function (req, res) { res.send("NodeJS fonctionne!") });

//Capture la requete POST pour la traiter et renvoie un resultat

router.post('/',function(req,res){
	res.setHeader('Content-Type', 'application/json');
	var object;
	var docs;
	var liste= (req.body.elt);
	var dataresponse = new Array;
	var promessefinal= new Promise(
		function(resolve,reject){
	for (var i=0;i<liste.length;i++){
		switch(checktype(liste[i].elt_id)){
			case 0:	//Traitement du cas des coordonnees
				var lat_lon=setcoord(liste[i].elt_id);
				dataresponse.push({elt_id : liste[i].elt_id, lat : lat_lon[0], lon : lat_lon[1]});
				break;
			case 1:	//Traitement du cas des IP
				var ip = (liste[i].elt_id).replace(/ /g,"");
				var geo = cities.getGeoDataSync(ip);
				if(geo){	//Si l'IP est present dans la base de donnee, on place ses informations dans un objet JSON
					dataresponse.push({elt_id : ip, lat : geo.location.latitude, lon : geo.location.longitude});
				}
			case 2:	//Traitement par gisgraphy
				var promesse= new Promise(
					function(resolve,reject){
				var xhr= new XMLHttpRequest();
				xhr.onload = function() {
				if (xhr.status == 200) {
					resolve(xhr.responseText);	//Si status requete 200, on stock le resultat de la requete
					}
				else{
					reject(Error(xhr.status));	//On stock le code d'erreur
					}
				}
				xhr.open("GET","http://localhost:8081/fulltext/fulltextsearch?q="+liste[i].elt_id+"&placetype=city&placetype=country&placetype=adm&__multiselect_placetype=&format=JSON&from=1&to=1",true)
				xhr.send();});

				promesse.then(function(response){
					object=JSON.parse(response)		//parsing JSON du resultat de la requete
					docs= object.response.docs[0];

				},function(error){
					console.log("Echec", error);});
					
				promesse.done(function(){
					if(object.response.numFound!=0){	//Si le resultat contenait une correspondance avec les informations sur l'element recherche
						dataresponse.push({elt_id: docs.name, lat: docs.lat, lon: docs.lng, pop: docs.population});	//On recupere les informations necessaire que l'on stocke dans un objet JSON
						console.log(dataresponse);}
					});
				break;
				}
				
	}
	//Timer pour gerer l'asynchronisme, nous permettant ainsi de ne pas attendre indefiniment les requetes qui n'aboutisse pas
	setTimeout(function(){resolve(dataresponse);},300+liste.length*50);	
	});
	promessefinal.done(function(response){
	res.send(JSON.stringify(response));		//Envoie du JSON contenant les information des differents elements recherches
	});

	
});


	


//Fonction de verification du type d'un element

function checktype(elt){
	if(regexcoord.test(elt)){
		return 0
	}
	else if(regexip.test(elt)){
		return 1;
	}
	else{
		return 2;}
};

function setcoord(elt){
	var tabcoord= elt.split(regsplitlatlon);
	return tabcoord;
};

//Mise en ecoute du serveur sur le port 8080

server.listen(process.env.PORT || 8080, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Geostar server listening at", addr.address + ":" + addr.port);
});
