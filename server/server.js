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
    collision_checker_radius;
    constructor(){
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

        //vertices
        this.va = {x: this.x, y: this.y};
        this.vb = {x: this.x + this.width, y: this.y};
        this.vc = {x: this.x + this.width, y: this.y + this.height};
        this.vd = {x: this.x, y: this.y + this.height};

        //collision 
        this.collision_checker_radius = 10;
    }

    move(direction, delta, map){
        if (this.angle > Math.PI*2 || this.angle < -Math.PI*2) this.angle = 0;
        if (direction.left) this.angle -= this.r_speed * delta;
        if (direction.right) this.angle += this.r_speed * delta;
        if (direction.forwards){ this.h_speed = Math.cos(this.angle) * this.a * delta; this.v_speed = Math.sin(this.angle) * this.a * delta;}
        else if (direction.backwards){ this.h_speed = -Math.cos(this.angle) * this.a * delta; this.v_speed = -Math.sin(this.angle) * this.a * delta;}
        else{this.h_speed = 0 ; this.v_speed = 0;}

        this.bullet.move(direction, this, delta);

        this.x += this.h_speed;
        this.y += this.v_speed;
        this.update_vertices();

        this.check_collisions(map, direction);
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

    check_collisions(map, direction){
        map.forEach(segment => {
            if (segment.va.x > this.x + this.width + this.collision_checker_radius ||
                segment.vb.x < this.x - this.collision_checker_radius ||
                segment.va.y > this.y + this.height + this.collision_checker_radius ||
                segment.vd.y < this.y - this.collision_checker_radius) return;
            
            if (this.collides(segment)) {
                //console.log('collision');
            }
        });
    }
    
    get_axis(vertex1, vertex2){
        return {x: vertex2.x - vertex1.x, y: vertex2.y - vertex1.y};
    }
    get_dot_product(axis, vertex){
        let constant = (vertex.x * axis.x + vertex.y * axis.y)/(axis.x * axis.x + axis.y * axis.y);
        return  constant * axis.x + constant * axis.y;
    }
    get_rect_vertex_projections(axis, vertecies){
        let dot_products = [];
        for (let i = 0; i < vertecies.length; i++) {
            let dot_product = this.get_dot_product(axis, vertecies[i]);
            dot_products.push(dot_product);
        }
        return dot_products;
    }
    get_min_max(rect1, rect, axis_array){
        let rect1_vertices = [rect1.va, rect1.vb, rect1.vc, rect1.vd];
        let rect_vertices = [rect.va, rect.vb, rect.vc, rect.vd];
        let overlaps = [];

        for (let i = 0; i < 2; i++) {
            let dot_product_rect1 = [this.get_dot_product(axis_array[i], rect1_vertices[i]), this.get_dot_product(axis_array[i], rect1_vertices[i+1])];
            
            let dot_product_rect = this.get_rect_vertex_projections(axis_array[i], rect_vertices);
    
            let min_rect1 = Math.min(...dot_product_rect1);
            let max_rect1 = Math.max(...dot_product_rect1);
            let min_rect = Math.min(...dot_product_rect);
            let max_rect = Math.max(...dot_product_rect);
    
            let overlap_a = max_rect - min_rect1;
            let overlap_b = max_rect1 - min_rect;            

            if (overlap_a < 0.001) return;
            else overlaps.push(overlap_a);
            if (overlap_b < 0.001) return;
            else overlaps.push(overlap_b);
        }
        
        return overlaps;
    }

    resolve_collision(rect1, overlap, axis) {
        let minOverlap = overlap;
        let minAxis = axis;
    
        // Normalize the axis (collision normal)
        let normal = null;
        let magnitude = Math.sqrt(minAxis.x * minAxis.x + minAxis.y * minAxis.y);
        if (magnitude > 0.001) {  // Avoid division by zero
            normal = { x: minAxis.x / magnitude, y: minAxis.y / magnitude };
        } else {
            return; // No valid collision direction
        }
    
        // Project linear movement onto the collision normal
        let dotProduct = (rect1.h_speed * normal.x + rect1.v_speed * normal.y);
    
        if (dotProduct < 0) { // Moving into the object
            rect1.x += minOverlap * normal.x;
            rect1.y += minOverlap * normal.y;
        } else { // Moving away from the object, flip normal
            rect1.x -= minOverlap * normal.x;
            rect1.y -= minOverlap * normal.y;
        }
    }
    
    
    

    collides (rect){
        //all axes
        let axis_this = {first: this.get_axis(this.va, this.vb), second: this.get_axis(this.vb, this.vc)};
        let axis_rect = {first: this.get_axis(rect.va, rect.vb), second: this.get_axis(rect.vb, rect.vc)};

        let overlaps_this_axis = this.get_min_max(this, rect, [axis_this.first, axis_this.second]);
        if (!overlaps_this_axis) return false;

        let overlaps_rect_axis = this.get_min_max(rect, this, [axis_rect.first, axis_rect.second]);
        if (!overlaps_rect_axis) return false;
        
        overlaps_this_axis.push(...overlaps_rect_axis);

        //qr, njer axes njer axis :(
        //the overlaps are related to the axes as followed based on index: 
        //0,1 - axes_this.first, 2,3 - axes_this.second, 4,5 - axes_rect.first, 6,7 - axes_rect.second
        let index = 0;
        for (let i = 1; i < overlaps_this_axis.length; i++) {
            if (overlaps_this_axis[index] > overlaps_this_axis[i]) {
                index = i;
            }
        }
        
        let collision_vector;
        if (index == 0 || index == 1) collision_vector = axis_this.first;
        else if (index == 2 || index == 3) collision_vector = axis_this.second;
        else if (index == 4 || index == 5) collision_vector = axis_rect.first;
        else if (index == 6 || index == 7) collision_vector = axis_rect.second;
        
                

        this.resolve_collision(this, overlaps_this_axis[index], collision_vector) //collision vector is the axes
        return true;
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



const THICKNESS = 5;
const WIDTH = 1536;
const HEIGHT = 703;

let map = [
    //map edges
    new segment(0, 0, THICKNESS, HEIGHT),  
    new segment(0, 0, WIDTH, THICKNESS),  
    new segment(WIDTH-THICKNESS, 0, THICKNESS, HEIGHT),  
    new segment(0, HEIGHT-THICKNESS, WIDTH, THICKNESS),
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
        console.log('fps :', c);
        stack = 0;
        c = 0;
    }
}