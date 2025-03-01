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
    r_speed;
    angle;
    a;
    constructor(){
        this.height = 40;
        this.width = 35;
        this.x = Math.round(200 * Math.random());
        this.y = 100;
        this.h_speed = 0;
        this.v_speed = 0;
        this.angle = 0;
        this.a = 3;
        this.r_speed = 0.1;
    }

    move(direction){
        if (direction.left) this.angle -= this.r_speed;
        if (direction.right) this.angle += this.r_speed;
        if (direction.forwards){ this.h_speed = Math.cos(this.angle) * this.a; this.v_speed = Math.sin(this.angle) * this.a;}
        else if (direction.backwards){ this.h_speed = -Math.cos(this.angle) * this.a; this.v_speed = -Math.sin(this.angle) * this.a;}
        else{this.h_speed = 0 ; this.v_speed = 0;}

        this.x += this.h_speed;
        this.y += this.v_speed;
    }
}
let players = [];
let ids = [];

let last_time = Date.now();
const FIXED_TIME = 1000/60;

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
        let recent_time = Date.now();
        let elapsed = recent_time - last_time;

        let found_object = players.find(obj => obj.hasOwnProperty(clientId));
        let tank = found_object[clientId];

        if (elapsed > FIXED_TIME) {
            tank.move(direction);
            io.emit('update', players);
            last_time = recent_time;
        }
        
    });

    socket.on('disconnect',()=>{
        let found_object = players.find(obj => obj.hasOwnProperty(clientId));
        players.splice(players.indexOf(found_object), 1);
        console.log(clientId, 'has disconnected');
        io.emit('update', players);
    })
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});