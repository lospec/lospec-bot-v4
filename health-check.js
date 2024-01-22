import http from 'http';

const host = 'localhost';
const port = 8080;

const requestListener = function (req, res) {
    res.writeHead(200);
    res.end("I'm a-okay, no need to kill me!");
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log('Health check bypass web server is running on http://'+host+':'+port);
});

export default server;