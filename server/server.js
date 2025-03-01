const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("../public/")); // Serve client files from "public" folder


class tank{
    height;
    width;
    x;
    y;
    h_speed;
    v_speed;
    constructor(){
        this.height = 50;
        this.width = 25;
        this.x = Math.round(1000 * Math.random());
        this.y = 100;
        this.h_speed = 1;
        this.v_speed = 1;
    }
}
let players = [];
let ids = [];
io.on("connection", (socket) => {
    let clientId = socket.handshake.query.clientId;
    
    if (!ids[clientId]) {
        let new_player = {};
        new_player[clientId] = new tank();
        players.push(new_player);
        ids[clientId] = true;
    }

    socket.removeAllListeners("movement");

    io.emit('new_connection', players);
    socket.on('movement', (direction)=>{
        console.log(direction);
        //TODO : update the players array here
    })
});


server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});