const express = require("express");
const http = require("http");
const { getActiveResourcesInfo } = require("process");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("../public/")); // Serve client files from "public" folder

//map 
const THICKNESS = 15;
const WIDTH = 1536;
const HEIGHT = 703;

let players = {};
let bullets = {};

let potential_spawns = [
    {x: 80, y: 80, taken: false},
    {x: WIDTH - 100, y: 80, taken: false},
    {x: 80, y: HEIGHT - 80, taken: false},
    {x: WIDTH - 100, y: HEIGHT - 80, taken: false},
];

let colors = [
    {color: 'red', taken_by: null},
    {color: 'blue', taken_by: null},
    {color: 'yellow', taken_by: null},
    {color: 'green', taken_by: null},
    {color: 'purple', taken_by: null},
    {color: 'cyan', taken_by: null},
]
class bullet{
    size;
    x;
    y;
    h_speed;
    v_speed;
    v_a;
    h_a;
    time_since;
    BULLET_TIME;
    shooting;
    angle;

    collidable;
    collision_activation_time;
    constructor(tank){
        this.size = 7;
        this.y = tank.y - (this.size / 2) + tank.height/2;
        this.x = tank.x + tank.width;
        this.rotate(tank);
        this.h_a = 5;
        this.v_a = 5;
        this.h_speed = 0;
        this.v_speed = 0;
        this.angle = tank.angle;
        
        this.time_since = 0;
        this.BULLET_TIME = 4000;
        
        this.collidable = false;
        this.collision_activation_time = 30;

        this.va = { x: this.x, y: this.y };
        this.vb = { x: this.x + this.size, y: this.y };
        this.vc = { x: this.x + this.size, y: this.y + this.size };
        this.vd = { x: this.x, y: this.y + this.size };
    }
    
    rotate(tank){
        let cx = tank.x + tank.width / 2;
        let cy = tank.y + tank.height / 2;
        let sinA = Math.sin(tank.angle);
        let cosA = Math.cos(tank.angle);
        let relX = this.x - cx + this.size/2;
        let relY = this.y - cy + this.size/2;
        
        this.x = (relX * cosA - relY * sinA) + cx;
        this.y = (relX * sinA + relY * cosA) + cy;
    }
    

    move(delta, map){  
        this.update_vertices();  
        this.collides(map);

        this.h_speed = Math.cos(this.angle) * this.h_a;
        this.v_speed = Math.sin(this.angle) * this.v_a;
        this.x += this.h_speed * delta;
        this.y += this.v_speed * delta;
    }

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
    constructor(color) {
        this.height = 35;
        this.width = 40;

        //generate random spawn point
        let found = false;
        let count = 0;
        while (!found){
            let spawn = Math.round(Math.random() * 3); // get random index
            if (!potential_spawns[spawn].taken) {
                this.x = potential_spawns[spawn].x;
                this.y = potential_spawns[spawn].y;
                potential_spawns[spawn].taken = true;
                found = true;
                break;
            }
            count ++;
            if (count > potential_spawns.length) {
                this.x = WIDTH / 2;
                this.y = HEIGHT / 2;
                found = true;
                break;
            }
        }

        this.h_speed = 0;
        this.v_speed = 0;
        this.angle = 0;
        this.a = 2;
        this.r_speed = 0.05;
        //this.bullet = new bullet(this);

        this.va = { x: this.x, y: this.y };
        this.vb = { x: this.x + this.width, y: this.y };
        this.vc = { x: this.x + this.width, y: this.y + this.height };
        this.vd = { x: this.x, y: this.y + this.height };
        
        this.collision_checker_radius = 100;
        this.died = false;
        
        this.direction = {
            left: false,
            right: false,
            top: false,
            bottom: false, 
            shoot: false
        };

        this.bullet_timeout = 4000;
        this.cur_bullet_time = 4000;

        this.color = color;
    }
    move(direction, delta, map, players) {
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
        for (let clientId in bullets){
            if (bullets[clientId]){
                let bullet = bullets[clientId];

                if (
                    bullet.va.x > this.x + this.width + this.collision_checker_radius ||
                    bullet.vb.x < this.x - this.collision_checker_radius ||
                    bullet.va.y > this.y + this.height + this.collision_checker_radius ||
                    bullet.vd.y < this.y - this.collision_checker_radius
                ) return;
                if(this.collides(bullet) && bullet.collidable){
                    delete bullets[clientId];
                    this.died = true;
                    if (this == players[clientId]) {
                        this.cur_bullet_time = this.bullet_timeout;
                    }
                    else{
                        players[clientId].cur_bullet_time = players[clientId].bullet_timeout;
                    }
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

let map = [
    //map edges
    new segment(0, 0, THICKNESS, HEIGHT),  
    new segment(0, 0, WIDTH, THICKNESS),  
    new segment(WIDTH-THICKNESS, 0, THICKNESS, HEIGHT),  
    new segment(0, HEIGHT-THICKNESS, WIDTH, THICKNESS),

    //corner segments
    new segment (200, 0, THICKNESS, 200),
    new segment (0, HEIGHT - 200, 200, THICKNESS),
    new segment (WIDTH - 200 , 200, 200, THICKNESS),
    new segment (WIDTH - 200, HEIGHT-200, THICKNESS, 200),
    
    //others
    new segment (350, 100, THICKNESS, 200),
    new segment (100, 300, 250 + THICKNESS, THICKNESS),
    new segment (350, HEIGHT - 300, THICKNESS, 200),
    new segment (100, 400, 250 + THICKNESS, THICKNESS),
    new segment (WIDTH - 350, 100, THICKNESS, 200),
    new segment (WIDTH - 350, 300, 250, THICKNESS),
    new segment (WIDTH - 350, HEIGHT - 300, THICKNESS, 200),
    new segment (WIDTH - 350, 400, 250, THICKNESS),
    new segment (WIDTH / 2 - 200, 200, 400, THICKNESS),
    new segment (WIDTH / 2 - 200, HEIGHT - 200, 400, THICKNESS),
    new segment (WIDTH/2, 200, THICKNESS, HEIGHT - 400),
    new segment ( 450, HEIGHT / 2, 200, THICKNESS),
    new segment ( WIDTH - 650, HEIGHT / 2, 200, THICKNESS),
    new segment ( 650, 0, THICKNESS, 100),
    new segment ( 650, HEIGHT - 100, THICKNESS, 100),
    new segment ( WIDTH - 650, 0, THICKNESS, 100),
    new segment ( WIDTH - 650, HEIGHT - 100, THICKNESS, 100),
];


io.on("connection", (socket) => {
    let clientId = socket.handshake.query.clientId.toString();
    
    let color = get_color(clientId);
    if (!players[clientId]) players[clientId] = new tank(color);
    
    console.log('players : ', Object.keys(players).length);
    
    socket.removeAllListeners("movement");
    
    //emit player position
    io.emit('new_connection', players);
    
    //emit map
    socket.emit('map', map);

    //update player to all if game has not started
    socket.on('movement', (dir)=> {
        if (players[clientId]) players[clientId].direction = dir;
    });

    socket.on('disconnect',()=> {
        delete players[clientId];
        console.log(clientId, 'has disconnected');
        io.emit('update', players);
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});

setInterval(update, 1000/70);
let last_time = Date.now();
function update(){
    let delta = (Date.now() - last_time) / 10;

    for (let clientId in players){
        if (players[clientId] && players[clientId].died){ players[clientId] = null; check_players(players);}
        else if (players[clientId]) {
            players[clientId].move(players[clientId].direction, delta, map, players);
            try_shoot(clientId, delta, map);
        }
    }

    show_fps();
    last_time = Date.now();
    //emit to all
    io.emit('update', [players, bullets]);
}

function try_shoot(clientId, delta, map){
    let tank = players[clientId];
    
    if (tank.direction.shoot && tank.cur_bullet_time >= tank.bullet_timeout) {
        
        bullets[clientId] = new bullet(tank);
        tank.cur_bullet_time = 0;
    }
    if (tank.cur_bullet_time <= tank.bullet_timeout) {
        tank.cur_bullet_time += (delta * 10);
    }
    
    let n_bullet = bullets[clientId];
    //make bullet collidable after some time
    if (n_bullet && n_bullet.time_since >= n_bullet.collision_activation_time) {
        bullets[clientId].collidable = true;
    }
    //if enough time passed, despawn
    if (n_bullet && n_bullet.time_since >= n_bullet.BULLET_TIME) {
        delete bullets[clientId];
    }
    if (n_bullet) {
        n_bullet.time_since += (delta * 10);

        //update bullet
        n_bullet.move( delta, map);
    }
    
}

function are_all_dead(players){//...but one
    let alive = 0;
    for (let player in players){
        if (players[player]){
            alive++;
        };
    }
    
    if (alive <= 1) return true;

    return false;
}

function check_players(players){
    //restart game if necessary
    if (are_all_dead(players)) {
        setTimeout(()=> {reset_game(players)}, 1000);
    }
}
function reset_game(players){
    //reset spawns 
    potential_spawns.forEach( element => {
        element.taken = false;
    });

    //reset bullets
    bullets = {};

    //reset players
    for (let clientId in players){
        let color = get_color(clientId);
        players[clientId] = new tank(color);
    }
    console.log('game restarted');
}

function get_color(clientId){
    for ( let i = 0; i < colors.length; i++){
        if (colors[i].taken_by == clientId) {
            return colors[i].color;
        }
    }

    for ( let i = 0; i < colors.length; i++){
        if (colors[i].taken_by == null) {
            colors[i].taken_by = clientId;
            return colors[i].color;
        }
    }

    return 'black'; //default fallback color
}

let lastTime = Date.now();
let frameCount = 0;
function show_fps() {
    frameCount++;
    let currentTime = Date.now();
    let elapsedTime = currentTime - lastTime;

    // Only update FPS once per second
    if (elapsedTime >= 1000) {
        //console.log('FPS: ', frameCount);
        lastTime = currentTime;
        frameCount = 0; 
    }
}