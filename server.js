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
	var liste= (req.body.elt);
	var dataresponse = new Array;
	var promessefinal= new Promise(
		function(resolve,reject){
	var compteur=0;
	for (var i=0;i<liste.length;i++){
		var element;
		if((liste[i].elt_id).indexOf(":")>-1){
			element = liste[i].elt_id.split(":")[0];
			console.log(element);
		}
		else{
			element = liste[i].elt_id;
			console.log(element);
		}
		switch(checktype(element)){
			case 0:
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
			case 1:
				var promesse= new Promise(function(resolve,reject){
					var elt_ip= liste[i].elt_id;
					var ip = (element).replace(/ /g,"");

					cities.getGeoData(ip,function(err,geodata){
					if(geodata){
						resolve({elt_id : elt_ip, info : geodata});
						}
					else{
						resolve({elt_id : elt_ip, type : 1, err : 1});
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
			
			case 2:
				var promesse= new Promise(
					function(resolve,reject){
				var dico =  {};
				dico['objet'] = liste[i].elt_id;
				var xhr= new XMLHttpRequest();
				xhr.onload = function() {
				if (xhr.status == 200) {	//Si status requete 200, on stock le resultat de la requete
					var res=JSON.parse(xhr.responseText);	//parsing JSON du resultat de la requete
					console.log(res.response.docs[0]);		
					if(res.response.numFound!=0){
					var promesse= new Promise(
					function(resolve,reject){
					var xhr= new XMLHttpRequest();
					xhr.onload = function() {
					if (xhr.status == 200) {
						resolve(JSON.parse(xhr.responseText));
						}
					else if (xhr.status!=200){
						reject(Error(xhr.status));
						}
					}
					console.log(res.response.docs[0].name+","+res.response.docs[0].country_name);
					xhr.open("GET","http://coko.synology.me:8083/?debug=0&responseIncludes=WKT_GEOMETRY_SIMPLIFIED&&query="+res.response.docs[0].name_ascii+","+res.response.docs[0].country_name,true);
					xhr.send();
					});

					promesse.then(function(response){
					dico['info']=response.interpretations[0].feature;
					resolve(dico);
					});
					}
					else if(res.response.numFound==0){
						dico['info']=0;
						resolve(dico);
						}
					}
				else if (xhr.status!=200){
					reject(Error(xhr.status));
					}
				}

				xhr.open("GET","http://coko.synology.me:8081/fulltext/fulltextsearch?q="+liste[i].elt_id+"&allwordsrequired=true&country=&spellchecking=true&__checkbox_spellchecking=true=&format=JSON&from=1&to=1",true)
				xhr.send();});

				promesse.then(function(response){
					if(response.info==0){	//Pas de correspondance
						dataresponse.push({elt_id : response.objet, type: 2, err: 1});
						}
					else{
						var geometry=response.info.geometry;
						var polygon_final= new Array();
						var polygon_initial;
						var nb_polygon;
						if(geometry.wktGeometrySimplified){
						if((geometry.wktGeometrySimplified).substring(0,5)=="MULTI"){
							polygon_initial=((geometry.wktGeometrySimplified).substring(15,((geometry.wktGeometrySimplified).length)-3)).split("), (");

							for (var j=0;j<polygon_initial.length;j++){
								var polygon= new Array();
								var multi_polygon= ((polygon_initial[j].replace("(","")).replace(")","")).split(", ");
								for (var k=0;k<multi_polygon.length;k++){
									var coord_polygon=multi_polygon[k].split(" ");
									polygon.push([parseFloat(coord_polygon[1]),parseFloat(coord_polygon[0])]);
								}
								//console.log(polygon);
								polygon_final.push(polygon);
							}
							nb_polygon= polygon_initial.length;
						}
						
						else{
							polygon_initial=((geometry.wktGeometrySimplified).substring(10,((geometry.wktGeometrySimplified).length)-3)).split(", ");						
							console.log(polygon_initial);
							for ( var j=0;j < polygon_initial.length;j++){
								var coord_polygon=polygon_initial[j].split(" ");
								polygon_final.push([parseFloat(((coord_polygon[1].replace("(","")).replace("(",""))),parseFloat(((coord_polygon[0].replace("(","")).replace("(","")))]);
							}
							console.log(polygon_final);
							nb_polygon= 1
						}
						dataresponse.push({elt_id : response.objet, elt_name : response.info.displayName, lat : geometry.center.lat, lon : geometry.center.lng, bounds : geometry.bounds,'nb_polygon': nb_polygon, polygon: polygon_final, pop : response.info.attributes.population, type : 2, err : 0});
					}
					else{
						dataresponse.push({elt_id : response.objet, elt_name : response.info.displayName, lat : geometry.center.lat, lon : geometry.center.lng, bounds : geometry.bounds, pop : response.info.attributes.population, type : 2, err : 0});
					}
					
				}},function(error){
					dataresponse.push({elt_id : response.objet, type: 2, err: 2});
				});
					
				promesse.done(function(){
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
		res.send(JSON.stringify(response));
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
		return 2;
	}
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