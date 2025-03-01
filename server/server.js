const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("../public/")); // Serve client files from "public" folder

class bullet{
    size;
    x;
    y;
    h_speed;
    v_speed;
    a;
    last_time;
    BULLET_TIME;
    shooting;
    angle;

    constructor(tank){
        this.size = 5;
        this.y = tank.y + tank.width / 2;
        this.x = tank.x + tank.height / 2;
        this.a = 6;
        this.angle = tank.angle;

        this.last_time = Date.now();
        this.BULLET_TIME = 2500;
        this.shooting = false;
    }
    move(direction, tank, delta){
        if(direction.shoot)this.shooting = true;

        let current_time = Date.now();
        let time_elapsed = current_time - this.last_time;
        if (this.shooting && time_elapsed < this.BULLET_TIME){
            this.h_speed = Math.cos(this.angle) * this.a * delta;
            this.v_speed = Math.sin(this.angle) * this.a * delta;
            this.x += this.h_speed;
            this.y += this.v_speed;
        }
        else{
            this.shooting = false;
            this.last_time = current_time;
            this.y = tank.y -2+ tank.width / 2;
            this.x = tank.x + tank.height / 2;
            this.angle = tank.angle;
        }
    }
}
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
    bullet;

    constructor(){
        this.height = 40;
        this.width = 35;
        this.x = Math.round(200 * Math.random());
        this.y = 100;
        this.h_speed = 0;
        this.v_speed = 0;
        this.angle = 0;
        this.a = 2;
        this.r_speed = 0.05;
        this.bullet = new bullet(this);
    }

    move(direction, delta){
        if (direction.left) this.angle -= this.r_speed * delta;
        if (direction.right) this.angle += this.r_speed * delta;
        if (direction.forwards){ this.h_speed = Math.cos(this.angle) * this.a * delta; this.v_speed = Math.sin(this.angle) * this.a * delta;}
        else if (direction.backwards){ this.h_speed = -Math.cos(this.angle) * this.a * delta; this.v_speed = -Math.sin(this.angle) * this.a * delta;}
        else{this.h_speed = 0 ; this.v_speed = 0;}

        this.x += this.h_speed;
        this.y += this.v_speed;
    }
}



let players = [];
let ids = [];


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

    let last_time = Date.now();

    socket.on('movement', (direction)=>{

        let found_object = players.find(obj => obj.hasOwnProperty(clientId));
        let tank = found_object[clientId];

        let delta = (Date.now() - last_time) / 10;
        
        show_fps(delta*10);

        tank.move(direction, delta);
        tank.bullet.move(direction, tank, delta);
        
        io.emit('update', players); 
        last_time = Date.now();       
    });


    socket.on('disconnect',()=>{
        let found_object = players.find(obj => obj.hasOwnProperty(clientId));
        players.splice(players.indexOf(found_object), 1);
        ids[clientId] = false;
        console.log(clientId, 'has disconnected');
        io.emit('update', players);
    })
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
let stack = 0;
let c = 0;
function show_fps(delta){
    stack += delta;
    c++;
    if (stack >= 1000){
        console.log('fps :', c);
        stack = 0;
        c = 0;
    }
}