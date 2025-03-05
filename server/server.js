const express = require("express");
const http = require("http");
const { getActiveResourcesInfo } = require("process");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("../public/")); // Serve client files from "public" folder

let players = {};
class bullet{
    size;
    x;
    y;
    h_speed;
    v_speed;
    v_a;
    h_a;
    last_time;
    BULLET_TIME;
    shooting;
    angle;

    collidable;
    collision_activation_time;
    constructor(tank){
        this.size = 7;
        this.y = tank.y - (this.size / 2) + tank.height/2;
        this.x = tank.x - (this.size / 2) + tank.width + this.size;
        this.h_a = 4;
        this.v_a = 4;
        this.h_speed = 0;
        this.v_speed = 0;
        this.angle = tank.angle;
        
        this.last_time = Date.now();
        this.BULLET_TIME = 4000;
        this.shooting = false;

        this.va = { x: this.x, y: this.y };
        this.vb = { x: this.x + this.size, y: this.y };
        this.vc = { x: this.x + this.size, y: this.y + this.size };
        this.vd = { x: this.x, y: this.y + this.size };

        this.collidable = false;
        this.collision_activation_time = 160;
    }
    /*
    rotate(tank){
        let cx = tank.x + tank.width / 2;
        let cy = tank.y + tank.height / 2;
        let sinA = Math.sin(tank.angle);
        let cosA = Math.cos(tank.angle);
        let relX = this.x - cx;
        let relY = this.y - cy;
        
        this.x = (relX * cosA - relY * sinA) + cx;
        this.y = (relX * sinA + relY * cosA) + cy;
    }
    */

    move(direction, tank, delta, map){  
        this.update_vertices(map);  
        this.collides(map);
        if(direction.shoot &&
        Math.abs(this.x - (tank.x - (this.size / 2) + (tank.width / 2))) <= 5 &&
        Math.abs(this.y - (tank.y - (this.size / 2) + (tank.height / 2))) <= 5 ) this.shooting = true;

        this.collidable = false;
        let current_time = Date.now();
        let time_elapsed = current_time - this.last_time;
        if (this.shooting && time_elapsed <= this.BULLET_TIME){
            this.h_speed = Math.cos(this.angle) * this.h_a;
            this.v_speed = Math.sin(this.angle) * this.v_a;
            this.x += this.h_speed * delta;
            this.y += this.v_speed * delta;

            //make it collidable after it leaves the tank
            if (time_elapsed >= this.collision_activation_time) {
                this.collidable = true;
            }
        }
        else{
            this.reset(tank);            
        }
    }

    reset(tank){
        this.collidable = false;
        this.shooting = false;
        this.last_time = Date.now();
        this.x = tank.x - (this.size / 2) + (tank.width / 2) ;
        this.y = tank.y - (this.size / 2) + (tank.height / 2);
        this.angle = tank.angle;
        this.h_a = 4;
        this.v_a = 4;
    };

    update_vertices(){
        this.va = { x: this.x, y: this.y };
        this.vb = { x: this.x + this.size, y: this.y };
        this.vc = { x: this.x + this.size, y: this.y + this.size };
        this.vd = { x: this.x, y: this.y + this.size };
    }

    collides(map){
        map.forEach( segment => {
            if (segment.va.x < this.vb.x &&
                segment.vb.x > this.va.x &&
                segment.va.y < this.vd.y &&
                segment.vd.y > this.va.y){
                
                //find the smalles overlap
                let overlap_right = this.vb.x - segment.va.x;
                let overlap_left = segment.vb.x - this.va.x;
                let overlap_bottom = this.vd.y - segment.va.y;
                let overlap_top = segment.vd.y - this.va.y;

                let smallest_overlap = Math.min(overlap_bottom, overlap_left, overlap_right, overlap_top);
    
                
                if (smallest_overlap == overlap_left) { this.x = segment.vb.x; this.h_a = this.h_a * -1;}
                if (smallest_overlap == overlap_right) { this.x = segment.va.x - this.size; this.h_a = this.h_a * -1;}
                if (smallest_overlap == overlap_bottom) { this.y = segment.va.y - this.size; this.v_a = this.v_a * -1;}
                if (smallest_overlap == overlap_top) { this.y = segment.vd.y; this.v_a = this.v_a * -1;}

            }
        });
    }
}

class tank {
    constructor() {
        this.height = 35;
        this.width = 40;
        this.x = 200;
        this.y = 100;
        this.h_speed = 0;
        this.v_speed = 0;
        this.angle = 0;
        this.a = 2;
        this.r_speed = 0.05;
        this.bullet = new bullet(this);

        this.va = { x: this.x, y: this.y };
        this.vb = { x: this.x + this.width, y: this.y };
        this.vc = { x: this.x + this.width, y: this.y + this.height };
        this.vd = { x: this.x, y: this.y + this.height };
        
        this.collision_checker_radius = 10;
        this.died = false;
    }
    move(direction, delta, map) {
        if (this.angle > Math.PI * 2 || this.angle < -Math.PI * 2) this.angle = 0;
        if (direction.left) this.angle -= this.r_speed * delta;
        if (direction.right) this.angle += this.r_speed * delta;
        if (direction.forwards) {
            this.h_speed = Math.cos(this.angle) * this.a * delta;
            this.v_speed = Math.sin(this.angle) * this.a * delta;
        } else if (direction.backwards) {
            this.h_speed = -Math.cos(this.angle) * this.a * delta;
            this.v_speed = -Math.sin(this.angle) * this.a * delta;
        } else {
            this.h_speed = 0;
            this.v_speed = 0;
        }

        
        this.x += this.h_speed;
        this.y += this.v_speed;
        this.update_vertices();

        this.bullet.move(direction, this, delta, map);

        this.check_collisions(map, players);
    }

    update_vertices() {
        let cx = this.x + this.width / 2;
        let cy = this.y + this.height / 2;
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

    check_collisions(map, players) {
        //map segments
        map.forEach(segment => {
            if (
                segment.va.x > this.x + this.width + this.collision_checker_radius ||
                segment.vb.x < this.x - this.collision_checker_radius ||
                segment.va.y > this.y + this.height + this.collision_checker_radius ||
                segment.vd.y < this.y - this.collision_checker_radius
            ) return;
            
            this.resolveCollision(segment);
        });

        //player bullets
        for (let clientId in players){
            if (players[clientId]){
                let player = players[clientId];
                if (
                    player.bullet.va.x > this.x + this.width + this.collision_checker_radius ||
                    player.bullet.vb.x < this.x - this.collision_checker_radius ||
                    player.bullet.va.y > this.y + this.height + this.collision_checker_radius ||
                    player.bullet.vd.y < this.y - this.collision_checker_radius
                ) return;
                if(this.collides(player.bullet) && player.bullet.collidable){
                    player.bullet.reset(player);
                    this.died = true;
                };
            }
        }
        
    }

    static project(vertices, axis) {
        let min = Infinity, max = -Infinity;
        for (let v of vertices) {
            let proj = (v.x * axis.x + v.y * axis.y);
            if (proj < min) min = proj;
            if (proj > max) max = proj;
        }
        return { min, max };
    }

    static overlap(proj1, proj2) {
        return !(proj1.max < proj2.min || proj2.max < proj1.min);
    }

    static getAxes(vertices) {
        let axes = [];
        for (let i = 0; i < vertices.length; i++) {
            let p1 = vertices[i], p2 = vertices[(i + 1) % vertices.length];
            let edge = { x: p2.x - p1.x, y: p2.y - p1.y };
            let normal = { x: -edge.y, y: edge.x };
            let length = Math.sqrt(normal.x ** 2 + normal.y ** 2);
            normal.x /= length;
            normal.y /= length;
            axes.push(normal);
        }
        return axes;
    }

    collides(obstacle) {
        let tankVertices = [this.va, this.vb, this.vc, this.vd];
        let obstacleVertices = [obstacle.va, obstacle.vb, obstacle.vc, obstacle.vd];
        let axes = [...tank.getAxes(tankVertices), ...tank.getAxes(obstacleVertices)];
        
        let minPenetration = Infinity;
        let smallestAxis = null;
        
        for (let axis of axes) {
            let proj1 = tank.project(tankVertices, axis);
            let proj2 = tank.project(obstacleVertices, axis);
            
            if (!tank.overlap(proj1, proj2)) {
                return null; // No collision
            }
            
            let overlap = Math.min(proj1.max, proj2.max) - Math.max(proj1.min, proj2.min);
            if (overlap < minPenetration) {
                minPenetration = overlap;
                smallestAxis = axis;
            }
        }

        let tankCenter = { x: this.x + this.width / 2, y: this.y + this.height / 2 };
        let obstacleCenter = { x: (obstacle.va.x + obstacle.vc.x) / 2, y: (obstacle.va.y + obstacle.vc.y) / 2 };
        let centerVector = { x: tankCenter.x - obstacleCenter.x, y: tankCenter.y - obstacleCenter.y };
        let dotProduct = centerVector.x * smallestAxis.x + centerVector.y * smallestAxis.y;
        if (dotProduct < 0) {
            smallestAxis.x *= -1;
            smallestAxis.y *= -1;
        }

        return { axis: smallestAxis, depth: minPenetration };
    }

    resolveCollision(obstacle) {
        let collision = this.collides(obstacle);
        if (!collision) return;
        
        let normal = collision.axis;
        let depth = collision.depth;

        // Project velocity onto the collision normal
        let velAlongNormal = this.h_speed * normal.x + this.v_speed * normal.y;

        // Only correct position if the tank is moving into the obstacle
        if (velAlongNormal < 0) {
            this.x += normal.x * depth;
            this.y += normal.y * depth;
            
            // Remove velocity component along the normal
            this.h_speed -= velAlongNormal * normal.x;
            this.v_speed -= velAlongNormal * normal.y;
        }
        
        this.update_vertices();
    }

}

class segment{
    height;
    width;
    x;
    y;
    
    va;
    vb;
    vc;
    vd;
    constructor(x, y, width, height){
        this.height = height;
        this.width = width;
        this.x = x;
        this.y = y;

        //vertices
        this.va = {x: this.x, y: this.y};
        this.vb = {x: this.x + this.width, y: this.y};
        this.vc = {x: this.x + this.width, y: this.y + this.height};
        this.vd = {x: this.x, y: this.y + this.height};
    }
}



const THICKNESS = 10;
const WIDTH = 1536;
const HEIGHT = 703;

let map = [
    //map edges
    new segment(0, 0, THICKNESS, HEIGHT),  
    new segment(0, 0, WIDTH, THICKNESS),  
    new segment(WIDTH-THICKNESS, 0, THICKNESS, HEIGHT),  
    new segment(0, HEIGHT-THICKNESS, WIDTH, THICKNESS),

    //other
    new segment (300, 0, THICKNESS, 300),
    new segment (600, 0, THICKNESS, 300),
    new segment (0, 500, 300, THICKNESS),
];

io.on("connection", (socket) => {
    let clientId = socket.handshake.query.clientId.toString();
    
    if (!players[clientId]) {
        players[clientId] = new tank();
    }
    console.log(Object.keys(players).length);
    

    socket.removeAllListeners("movement");
    
    //emit player position
    io.emit('new_connection', players);
    //emit map
    socket.emit('map', map);

    let last_time = Date.now();
    socket.on('movement', (direction)=>{
        let delta = (Date.now() - last_time) / 10;


        //player state (dead or alive)
        if (players[clientId] && players[clientId].died){ players[clientId] = null, console.log(clientId, "has been slayen", players);}
        else if (players[clientId]) players[clientId].move(direction, delta, map);
        

        io.emit('update', players);
        show_fps(delta*10);
        last_time = Date.now();
    });


    socket.on('disconnect',()=>{
        players[clientId] = null;
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
        //console.log('fps :', c);
        stack = 0;
        c = 0;
    }
}