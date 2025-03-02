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

    va;
    vb;
    vc;
    vd;

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

        //vertices
        this.va = {x: this.x, y: this.y};
        this.vb = {x: this.x, y: this.y + this.width};
        this.vc = {x: this.x + this.height, y: this.y + this.width};
        this.vd = {x: this.x + this.height, y: this.y};
    }

    move(direction, delta){
        if (this.angle > Math.PI*2 || this.angle < -Math.PI*2) this.angle = 0;
        if (direction.left) this.angle -= this.r_speed * delta;
        if (direction.right) this.angle += this.r_speed * delta;
        if (direction.forwards){ this.h_speed = Math.cos(this.angle) * this.a * delta; this.v_speed = Math.sin(this.angle) * this.a * delta;}
        else if (direction.backwards){ this.h_speed = -Math.cos(this.angle) * this.a * delta; this.v_speed = -Math.sin(this.angle) * this.a * delta;}
        else{this.h_speed = 0 ; this.v_speed = 0;}

        this.x += this.h_speed;
        this.y += this.v_speed;
        this.update_vertices();
        this.collides(this);
    }

    update_vertices(){
        let cx = this.x + this.width/2;
        let cy = this.y + this.height/2;
        let sinA = Math.sin(this.angle);
        let cosA = Math.cos(this.angle);
        let relX = this.x - cx;
        let relY = this.y - cy;

        this.va.x = (relX * cosA - relY * sinA) + cx;
        this.va.y = (relX * sinA + relY * cosA) + cy;

        relX = this.x + this.width - cx;
        relY = this.y - cy;
        this.vb.x = (relX * cosA - relY * sinA) + cx;
        this.vb.y = (relX * sinA + relY * cosA) + cy;
        
        relX = this.x + this.width - cx;
        relY = this.y + this.height - cy;
        this.vc.x = (relX * cosA - relY * sinA) + cx;
        this.vc.y = (relX * sinA + relY * cosA) + cy;

        relX = this.x - cx;
        relY = this.y + this.height - cy;
        this.vd.x = (relX * cosA - relY * sinA) + cx;
        this.vd.y = (relX * sinA + relY * cosA) + cy;        
    }

    collides(rect){
        let axis1_a = {x: this.vb.x - this.va.x, y: this.vb.y - this.va.y};
        let axis2_a = {x: this.vc.x - this.vb.x, y: this.vc.y - this.vb.y};

        let axis1_b = {x: rect.vb.x - rect.va.x, y: rect.vb.y - rect.va.y};
        let axis2_b = {x: rect.vc.x - rect.vb.x, y: rect.vc.y - rect.vb.y};

        //project vb to axis 1 for the first rect (a)
        let projection_vb = (this.vb.x * axis1_a.x + this.vb.y * axis1_a.y) / (axis1_a.x * axis1_a.x + axis1_a.y * axis1_a.y);
        let projection_vb_x = projection_vb * axis1_a.x;
        let projection_vb_y = projection_vb * axis1_a.y;
        let dot_product_vb = projection_vb_x * axis1_a.x + projection_vb_y * axis1_a.y;

        //project va to axis 1 for the first rect (a)
        let projection_va = (this.va.x * axis1_a.x + this.va.y * axis1_a.y) / (axis1_a.x * axis1_a.x + axis1_a.y * axis1_a.y);
        let projection_va_x = projection_va * axis1_a.x;
        let projection_va_y = projection_va * axis1_a.y;
        let dot_product_va = projection_va_x * axis1_a.x + projection_va_y * axis1_a.y;

        //project vb to axis 1 for the second rect (b)
        let projection_vb_b = (rect.vb.x * axis1_a.x + rect.vb.y * axis1_a.y) / (axis1_a.x * axis1_a.x + axis1_a.y * axis1_a.y);
        let projection_vb_b_x = projection_vb_b * axis1_a.x;
        let projection_vb_b_y = projection_vb_b * axis1_a.y;
        let dot_product_vb_b = projection_vb_b_x * axis1_a.x + projection_vb_b_y * axis1_a.y;

        //project va to axis 1 for the second rect (b)
        let projection_va_b = (rect.va.x * axis1_a.x + rect.va.y * axis1_a.y) / (axis1_a.x * axis1_a.x + axis1_a.y * axis1_a.y);
        let projection_va_b_x = projection_va_b * axis1_a.x;
        let projection_va_b_y = projection_va_b * axis1_a.y;
        let dot_product_va_b = projection_va_b_x * axis1_a.x + projection_va_b_y * axis1_a.y;

        //project vc to axis 1 for the second rect (b)
        let projection_vc_b = (rect.vc.x * axis1_a.x + rect.vc.y * axis1_a.y) / (axis1_a.x * axis1_a.x + axis1_a.y * axis1_a.y);
        let projection_vc_b_x = projection_vc_b * axis1_a.x;
        let projection_vc_b_y = projection_vc_b * axis1_a.y;
        let dot_product_vc_b = projection_vc_b_x * axis1_a.x + projection_vc_b_y * axis1_a.y;

        //project vd to axis 1 for the second rect (b)
        let projection_vd_b = (rect.vd.x * axis1_a.x + rect.vd.y * axis1_a.y) / (axis1_a.x * axis1_a.x + axis1_a.y * axis1_a.y);
        let projection_vd_b_x = projection_vd_b * axis1_a.x;
        let projection_vd_b_y = projection_vd_b * axis1_a.y;
        let dot_product_vd_b = projection_vd_b_x * axis1_a.x + projection_vd_b_y * axis1_a.y;


        let min_a = Math.min(dot_product_va, dot_product_vb);
        let min_b = Math.min(dot_product_va_b, dot_product_vb_b, dot_product_vc_b, dot_product_vd_b);
        let max_a = Math.max(dot_product_va, dot_product_vb);
        let max_b = Math.max(dot_product_va_b, dot_product_vb_b, dot_product_vc_b, dot_product_vd_b);

        if (min_b > max_a || max_b < min_a) return false;

        //repeat the same for axis 2 of rect a and so on
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