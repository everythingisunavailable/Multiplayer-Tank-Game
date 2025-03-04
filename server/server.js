const express = require("express");
const http = require("http");
const { getActiveResourcesInfo } = require("process");
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

        this.bullet.move(direction, this, delta);

        this.x += this.h_speed;
        this.y += this.v_speed;
        this.update_vertices();

        this.check_collisions(map, direction);
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

    check_collisions(map, direction) {
        map.forEach(segment => {
            if (
                segment.va.x > this.x + this.width + this.collision_checker_radius ||
                segment.vb.x < this.x - this.collision_checker_radius ||
                segment.va.y > this.y + this.height + this.collision_checker_radius ||
                segment.vd.y < this.y - this.collision_checker_radius
            ) return;

            this.resolveCollision(segment);
        });
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
    new segment (300, 0, THICKNESS, 300),
    new segment (0, 300, 300, THICKNESS)
];
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
    
    //emit player position
    io.emit('new_connection', players);
    //emit map
    socket.emit('map', map);

    let last_time = Date.now();

    socket.on('movement', (direction)=>{

        let found_object = players.find(obj => obj.hasOwnProperty(clientId));
        let tank = found_object[clientId];

        let delta = (Date.now() - last_time) / 10;
        
        show_fps(delta*10);

        tank.move(direction, delta, map);
        
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
        //console.log('fps :', c);
        stack = 0;
        c = 0;
    }
}