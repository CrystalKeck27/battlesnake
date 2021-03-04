"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const body_parser_1 = __importDefault(require("body-parser"));
const express_1 = __importDefault(require("express"));
const PORT = process.env.PORT || 3000;
const app = express_1.default();
app.use(body_parser_1.default.json());
app.get("/", handleIndex);
app.post("/start", handleStart);
app.post("/move", handleMove);
app.post("/end", handleEnd);
app.listen(PORT, () => console.log(`TypeScript Battlesnake Server listening at http://127.0.0.1:${PORT}`));
function handleIndex(request, response) {
    const battlesnakeInfo = {
        apiversion: "1",
        author: "",
        color: "#BADA55",
        head: "dead",
        tail: "fat-rattle"
    };
    response.status(200).json(battlesnakeInfo);
}
function handleStart(request, response) {
    const gameData = request.body;
    console.log("Start of game " + gameData.game.id);
    response.status(200).send("ok");
}
function remove(directions, direction) {
    let index = directions.indexOf(direction);
    if (index != -1) {
        directions.splice(index, 1);
        console.log("Removed " + direction);
    }
    return directions;
}
function hazardBoard(gameData) {
    let hazards = [];
    for (let i = 0; i < gameData.board.height; i++) {
        hazards[i] = [];
        for (let j = 0; j < gameData.board.width; j++) {
            hazards[i][j] = false;
        }
    }
    for (const snake of gameData.board.snakes) {
        // If the snake has full health that means it just ate, so it will be longer next turn, so we have to rule out moving to the tail.
        let len = snake.health == 100 || gameData.turn < 2 ? snake.length : snake.length - 1;
        for (let i = 0; i < len; i++) {
            hazards[snake.body[i].y][snake.body[i].x] = true;
        }
    }
    return hazards;
}
function region(hazards, location) {
    let area = [];
    for (let i = 0; i < hazards.length; i++) {
        area[i] = [];
        for (let j = 0; j < hazards[0].length; j++) {
            area[i][j] = false;
        }
    }
    function flood(loc) {
        area[loc.y][loc.x] = true;
        const adjs = [{ x: loc.x + 1, y: loc.y }, { x: loc.x, y: loc.y + 1 }, { x: loc.x - 1, y: loc.y }, { x: loc.x, y: loc.y - 1 }];
        for (const adj of adjs) {
            if (adj.x < 0)
                continue;
            if (adj.y < 0)
                continue;
            if (adj.x > hazards[0].length - 1)
                continue;
            if (adj.y > hazards.length - 1)
                continue;
            if (hazards[adj.y][adj.x])
                continue;
            if (area[adj.y][adj.x])
                continue;
            flood(adj);
        }
    }
    flood(location);
    let c = 0;
    for (let i = 0; i < area.length; i++) {
        for (let j = 0; j < area[i].length; j++) {
            if (area[i][j])
                c++;
        }
    }
    return c;
}
function handleMove(request, response) {
    const gameData = request.body;
    console.log("Turn: " + gameData.turn);
    const head = gameData.you.head;
    const possibleMoves = ["up", "down", "left", "right"];
    let narrowMoves = possibleMoves;
    const hazards = hazardBoard(gameData);
    // don't go backwards
    // if(head.x > gameData.you.body[1].x) {
    //     narrowMoves = remove(narrowMoves, "left");
    // } else if(head.x < gameData.you.body[1].x) {
    //     narrowMoves = remove(narrowMoves, "right");
    // } else if(head.y > gameData.you.body[1].y) {
    //     narrowMoves = remove(narrowMoves, "down");
    // } else {
    //     narrowMoves = remove(narrowMoves, "up");
    // }
    // Now handled elsewhere
    // don't run into wall
    if (head.x <= 0) {
        narrowMoves = remove(narrowMoves, "left");
    }
    if (head.x >= gameData.board.width - 1) {
        narrowMoves = remove(narrowMoves, "right");
    }
    if (head.y <= 0) {
        narrowMoves = remove(narrowMoves, "down");
    }
    if (head.y >= gameData.board.height - 1) {
        narrowMoves = remove(narrowMoves, "up");
    }
    // don't run into any snakes
    for (const snake of gameData.board.snakes) {
        // If the snake has full health that means it just ate, so it will be longer next turn, so we have to rule out moving to the tail.
        let len = snake.health == 100 || gameData.turn < 2 ? snake.length : snake.length - 1;
        for (let i = 0; i < len; i++) {
            let hazard = snake.body[i];
            if (hazard.x == head.x) {
                if (hazard.y == head.y - 1) {
                    narrowMoves = remove(narrowMoves, "down");
                }
                else if (hazard.y == head.y + 1) {
                    narrowMoves = remove(narrowMoves, "up");
                }
            }
            else if (hazard.y == head.y) {
                if (hazard.x == head.x - 1) {
                    narrowMoves = remove(narrowMoves, "left");
                }
                else if (hazard.x == head.x + 1) {
                    narrowMoves = remove(narrowMoves, "right");
                }
            }
        }
    }
    // Don't do head-to-head collisions
    for (const snake of gameData.board.snakes) {
        let dx = snake.head.x - head.x;
        let dy = snake.head.y - head.y;
        if (Math.abs(dx) + Math.abs(dy) == 2) {
            if (snake.length < gameData.you.length) {
            }
            else {
                if (dx > 0) {
                    remove(narrowMoves, "right");
                }
                else if (dx < 0) {
                    remove(narrowMoves, "left");
                }
                if (dy > 0) {
                    remove(narrowMoves, "up");
                }
                else if (dy < 0) {
                    remove(narrowMoves, "down");
                }
            }
        }
    }
    // Make a better choice than random
    let choices = [];
    for (let i = 0; i < narrowMoves.length; i++) {
        switch (narrowMoves[i]) {
            case "down":
                choices[i] = region(hazards, { x: head.x, y: head.y - 1 });
                break;
            case "up":
                choices[i] = region(hazards, { x: head.x, y: head.y + 1 });
                break;
            case "left":
                choices[i] = region(hazards, { x: head.x - 1, y: head.y });
                break;
            case "right":
                choices[i] = region(hazards, { x: head.x + 1, y: head.y });
                break;
        }
    }
    let largest = 0;
    let largestIndex = -1;
    for (let i = 0; i < choices.length; i++) {
        if (choices[i] > largest) {
            largest = choices[i];
            largestIndex = i;
        }
    }
    console.log(narrowMoves);
    console.log(choices);
    console.log(largest);
    for (let i = 0; i < narrowMoves.length; i++) {
        if (choices[i] < largest) {
            i--;
            choices.splice(i + 1, 1);
            narrowMoves.splice(i + 1, 1);
        }
    }
    console.log(narrowMoves);
    const move = narrowMoves[Math.floor(Math.random() * narrowMoves.length)];
    console.log("Moving " + move + "\n");
    response.status(200).send({
        move: move
    });
}
function handleEnd(request, response) {
    const gameData = request.body;
    console.log("End of game " + gameData.game.id);
    response.status(200).send("ok");
}
//# sourceMappingURL=index.js.map