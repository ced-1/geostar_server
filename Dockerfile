FROM ubuntu:precise
RUN echo 'we are running some # of cool things'
RUN apt-get update
RUN apt-get install -y \
	nodejs \
	npm
RUN mkdir /var/geostarServer/
COPY . /var/geostarServer/

EXPOSE 8080

CMD ["node", "/var/geostarServer/server.js"]

