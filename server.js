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
	var compteur=0;
	for (var i=0;i<liste.length;i++){
		switch(checktype(liste[i].elt_id)){
			case 0:		//Traitement des elements type coordonnees
				var promesse= new Promise(function(resolve,reject){
					resolve(setcoord(liste[i].elt_id));
					});
				promesse.done(function(response){			
					dataresponse.push({elt_id : response[2], lat : response[0], lon : response[1], type : 0, err : 0});
					compteur +=1;
				if (compteur == liste.length){
							resolve(dataresponse);
							}
				});
				break;
			case 1:		//Traitement des elements type IP
				var promesse= new Promise(function(resolve,reject){
					var ip = (liste[i].elt_id).replace(/ /g,"");

					cities.getGeoData(ip,function(err,geodata){
					if(geodata){	//Si l'IP est present dans la base de donnee, on place ses informations dans un objet JSON
						resolve({elt_id : ip, info : geodata});
						}
					else{	//On signale une erreur
						resolve({elt_id : ip, type : 1, err : 1});
				}});
				});
				promesse.done(function(response){
					compteur +=1;
					if (response.err==1){
						dataresponse.push(response);
					}
					else{
						dataresponse.push({elt_id : response.elt_id , lat : response.info.location.latitude, lon : response.info.location.longitude, type : 1, err : 0});
					}
				
					if (compteur == liste.length){				
								resolve(dataresponse);
						}
					});
				break
			
			case 2:	//Traitement des autres types d'elements via geocoder
				var promesse= new Promise(
					function(resolve,reject){
				var dico =  {};
				dico['objet'] = liste[i].elt_id;
				var xhr= new XMLHttpRequest();
				xhr.onload = function() {
				if (xhr.status == 200) {	//Si status requete 200, on stock le resultat de la requete
					dico['info']=JSON.parse(xhr.responseText);	//parsing JSON du resultat de la requete
					resolve(dico);
					}
				else if (xhr.status!=200){
					reject(Error(xhr.status));
					}
				}

				xhr.open("GET","http://localhost:8081/fulltext/fulltextsearch?q="+liste[i].elt_id+"&placetype=city&placetype=country&placetype=adm&__multiselect_placetype=&format=JSON&from=1&to=1",true)
				xhr.send();});

				promesse.then(function(response){
					object= response.info;
					docs= response.info.response.docs[0];
					if(object.response.numFound!=0){	//Si le resultat contenait une correspondance avec les informations sur l'element recherche
						dataresponse.push({elt_id : response.objet, elt_name : docs.name, lat : docs.lat, lon : docs.lng, pop : docs.population, type : 2, err : 0});
						}
					else if(object.response.numFound==0){	//Pas de correspondance
						dataresponse.push({elt_id : response.objet, type: 2, err: 1});
						}
					

				},function(error){	// Autres erreurs
					dataresponse.push({elt_id : response.objet, type: 2, err: 2});
				});
					
				promesse.done(function(response){
						
					compteur +=1
					if (compteur== liste.length){
						resolve(dataresponse);
						}
				});
				break;
			}
				
		}
	});
	promessefinal.done(function(response){
		res.send(JSON.stringify(response));	//Envoie du JSON contenant les information des differents elements recherches
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
		tabcoord.push(elt);
	return tabcoord;
};

//Mise en ecoute du serveur sur le port 8080

server.listen(process.env.PORT || 8080, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Geostar server listening at", addr.address + ":" + addr.port);
});
