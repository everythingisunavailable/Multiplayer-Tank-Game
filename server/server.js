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
let bullets = [];
let pickups = [];

let potential_spawns = [
    {x: 80, y: 80, taken: false},
    {x: WIDTH - 100, y: 80, taken: false},
    {x: 80, y: HEIGHT - 80, taken: false},
    {x: WIDTH - 100, y: HEIGHT - 80, taken: false},
];

let colors = [
    {color: 'red', taken_by: null},
    {color: 'blue', taken_by: null},
    {color: 'orange', taken_by: null},
    {color: 'green', taken_by: null},
    {color: 'purple', taken_by: null},
    {color: 'cyan', taken_by: null},
];

class pickup{
    x;
    y;
    size;
    type;
    constructor(x, y, type){
        this.x = x;
        this.y = y;
        this.size = 50;
        this.type = type;
    }
}

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

    piercing;
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

        this.piercing = tank.ability.pierce;

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
         //make bullet collidable after some time
        if (this.time_since >= this.collision_activation_time) {
            this.collidable = true;
        }
        //if enough time passed, despawn
        if (this.time_since >= this.BULLET_TIME) {
            bullets.splice(bullets.indexOf(this), 1);
        }
        this.time_since += (delta * 10);

        this.update_vertices();  
        if (!this.piercing) this.collides(map);
        

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
        this.A = 2;
        this.a = 2;
        this.r_speed = 0.05;
        

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
        this.BULLET_TIMEOUT = 4000;
        this.cur_bullet_time = 4000;

        this.color = color;


        //abilities from pickups
        this.ability = {
            speed: false,
            pierce: false,
            firerate: false,
            laser: false,
        };
        this.ABILITY_TIMEOUT = 3000;
        this.cur_ability_timer = 0;
        this.triggered_ability = false;

    }
    move(direction, delta, map, players, bullets) {
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
        
        this.check_collisions(map, players, pickups);
        this.ability_handler(delta);
        this.try_shoot(delta, bullets);
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

    activate_ability(type){
        for (let key in this.ability){

            this.ability[key] = false;

            if (key == type) {
                this.ability[key] = true;
                //reset ability timer
                this.cur_ability_timer = 0;
            }
        }
    }

    ability_handler(delta){
        if (this.direction.shoot) {
            this.triggered_ability = true;
        }
        if (this.cur_ability_timer < this.ABILITY_TIMEOUT) {
            if (this.triggered_ability) {
                this.cur_ability_timer += (delta * 10);
            }
        }
        else{
            //reset abilities
            for (let key in this.ability){
                this.ability[key] = false;
            }
            this.triggered_ability = false;
            this.cur_ability_timer = 0;
        }

        //speed
        if (this.ability.speed) {
            this.a = 5;
            this.triggered_ability = true;
        } else {
            this.a = this.A;
        }

        //fast fire
        if (this.ability.firerate) {
            this.bullet_timeout = 100;
            this.triggered_ability = false;
        } else {
            this.bullet_timeout = this.BULLET_TIMEOUT;
        }

        //piercing no need for code here

        //TODO : laser
    }

    check_collisions(map, players, pickups) {
        //map segments
        for ( let i = 0; i < map.length; i++){
            let segment = map[i];
            if (
                segment.va.x > this.x + this.width + this.collision_checker_radius ||
                segment.vb.x < this.x - this.collision_checker_radius ||
                segment.va.y > this.y + this.height + this.collision_checker_radius ||
                segment.vd.y < this.y - this.collision_checker_radius
            ) continue;
            
            this.resolveCollision(segment);
        };

        
        let tmp_bullets = [...bullets];
        //player bullets
        for ( let i = 0; i < tmp_bullets.length; i++){
            let bullet = tmp_bullets[i];

            if (
                bullet.va.x > this.x + this.width + this.collision_checker_radius ||
                bullet.vb.x < this.x - this.collision_checker_radius ||
                bullet.va.y > this.y + this.height + this.collision_checker_radius ||
                bullet.vd.y < this.y - this.collision_checker_radius
            ) continue;

            if(this.collides(bullet) && bullet.collidable){
                bullets.splice(i, 1);
                this.died = true;
            };
        }

        //pickups
        let index_to_be_deleted = null;
        for (let i = 0; i < pickups.length; i++){
            let element = pickups[i];

            if (
                element.x > this.x + this.width ||
                element.x + element.size < this.x ||
                element.y > this.y + this.width ||
                element.y + element.size < this.y
            ) continue;

            this.activate_ability(element.type.toString());
            index_to_be_deleted = i;
        }
        if (index_to_be_deleted != null) {
            pickups.splice(index_to_be_deleted, 1);
            index_to_be_deleted = null;
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

    try_shoot (delta, bullets){
        if (this.direction.shoot && this.cur_bullet_time >= this.bullet_timeout) {
            bullets.push(new bullet(this));
            this.cur_bullet_time = 0;
        }
        if (this.cur_bullet_time <= this.bullet_timeout) {
            this.cur_bullet_time += (delta * 10);
        }
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
    console.log("Server running port 3000");
});

setInterval(update, 1000/70);
let last_time = Date.now();
function update(){
    let delta = (Date.now() - last_time) / 10;

    //update player
    for (let clientId in players){
        if (players[clientId] && players[clientId].died) {

          players[clientId] = null;
          check_players(players);

        } else if (players[clientId]) {

          players[clientId].move(players[clientId].direction, delta, map, players, bullets);

        }
    }

    //update bullets
    update_bullets(bullets, delta, map);

    try_spawn_pickups(delta, map, pickups);

    show_fps();
    //emit to all
    last_time = Date.now();
    io.emit('update', [players, bullets, pickups]);
}
function update_bullets(bullets, delta, map){
    bullets.forEach( element => {
        element.move(delta, map);
    });
}

let cur_pickup_time = 0;
const PICKUP_SPAWN_TIME = 10000; //every 10 seconds
const MAX_SPAWN_COUNT = 4;
function try_spawn_pickups(delta, map, pickups){
    if (cur_pickup_time >= PICKUP_SPAWN_TIME) {
        //spawn here
        spawn_pickup(map, pickups);
        cur_pickup_time = 0;
    }
    if (pickups.length < MAX_SPAWN_COUNT) {
        cur_pickup_time += (delta * 10);
    }
}
function spawn_pickup(map, pickups){
    let pickup_types = ['speed', 'firerate', 'pierce']; //, 'laser'];
    let index = Math.floor(Math.random() * pickup_types.length);
    let type = pickup_types[index];

    while(true){
        let x = Math.round(Math.random() * WIDTH);
        let y = Math.round(Math.random() * HEIGHT);
        let temp_pickup = new pickup(x, y, type);

        //check for collision
        let collides_w_segment = false;
        for ( let i = 0; i < map.length; i++){
            let segment = map[i];
            if (
                !(segment.va.x > temp_pickup.x + temp_pickup.size ||
                segment.vb.x < temp_pickup.x ||
                segment.va.y > temp_pickup.y + temp_pickup.size ||
                segment.vd.y < temp_pickup.y)
            ){
                collides_w_segment = true;
                break;
            }

        }

        if (!collides_w_segment) {
            pickups.push(temp_pickup);
            return;
        }
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
    bullets = [];

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

//fps
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