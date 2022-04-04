window.onload = main;

function main() {
    var canvas = document.querySelector(".viewport");

    var piano = new Piano(canvas, 800, 200);
    piano.start();
}

class Piano {
    constructor(canvas, width, height) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d");
        this.width = width;
        this.height = height;

        this.audio_ctx = new AudioContext();
        this.sounds = []; // Array of ArrayBuffer data decoded by AudioContext from MP3 data on server

        this.key_buffer = []; // Ordered array of PianoKey objects for rendering (front -> back) and hit detection (back -> front)

        this.draw = this.draw.bind(this);
    }

    checkKeyHit(x, y) {
        // Traverse through key_buffer[] from back to front, return when a key is hit
        for(var i = this.key_buffer.length - 1; i >= 0; i--) {
            var key = this.key_buffer[i];
            if(key.rect.isPointInBounds(x, y)) {
                key.play(this.audio_ctx);
                return;
            }
        }
    }

    // Wrapper function for loading sound data and initializing app
    // Call sequence: loadSoundFiles() -> createKeys() -> draw() loop
    start() {
        this.initializeCanvas();
        this.#loadSoundFiles(() => {
            this.createKeys();
        });
    }

    initializeCanvas() {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx.clearRect(0, 0, this.width, this.height);

        this.canvas.addEventListener("click", (event) => {
            this.checkKeyHit(event.offsetX, event.offsetY);
        })
    }

    // Called by start() to begin sound loading process
    #loadSoundFiles(success_callback) {
        // Get array of sound file names from directory
        var req = new XMLHttpRequest();
        req.responseType = "text";
        req.open("GET", "php/load_sounds.php");
        req.onload = () => {
            // Decode sound data into arraybuffers from sounds directory using file names
            var sounds = JSON.parse(req.responseText);
            var remaining__reqs = sounds.length;

            sounds.forEach((sound, index) => {
                var path = "sounds/" + sound;
                var req = new XMLHttpRequest();
                req.responseType = "arraybuffer";
                req.open("GET", path);
                req.onload = () => {
                    // Decode arraybuffer data into sounds array for later playback
                    this.audio_ctx.decodeAudioData(req.response).then((buffer) => {
                        this.sounds[index] = buffer;

                        if(--remaining__reqs === 0) { // All sounds loaded successffully
                            success_callback();
                        }
                    });
                }
                req.send();
            })
        }
        req.send();
    }

    // Create PianoKey objects using sound buffer data
    createKeys() {
        var w1 = this.width / 21; // Primary key width value (white keys)
        var w2 = w1 / 2; // Secondary key width value (black keys)

        var white_keys = [];
        var black_keys = [];
        var black_key_locations = [1, 3, 6, 8, 10]; // Index locations of black keys in a 12 note octave.
                                                    // Checking a key's index against these using the modulus 
                                                    // operator can determine if the key is white or black.

        // Create new key objects and assign to subarrays by type
        for(var i = 0; i < this.sounds.length; i++) {
            var new_key;
            var x_offset = w1 * white_keys.length;

            if(black_key_locations.includes(i % 12)) {
                new_key = new PianoKey("black", this.sounds[i]);
                new_key.rect = new Rectangle(x_offset - w2 / 2, 0, w2, this.height * 0.625);
                black_keys.push(new_key);
            } else {
                new_key = new PianoKey("white", this.sounds[i]);
                new_key.rect = new Rectangle(x_offset, 0, w1, this.height);
                white_keys.push(new_key);
            }
        }

        // Populate key buffer array according to render order (white -> black)
        this.key_buffer = white_keys.concat(black_keys);

        // Begin animation loop
        window.requestAnimationFrame(this.draw);
    }

    // Called every frame. Renders all keys in key_buffer front to back.
    draw() {
        this.key_buffer.forEach((key) => {
            this.ctx.fillStyle = key.color.toString();

            if(key.type === "white") {
                this.ctx.strokeStyle = "gray";
                this.ctx.lineWidth = 2;
            } else {
                this.ctx.strokeStyle = "black";
                this.ctx.lineWidth = 1;
            }

            this.ctx.fillRect(key.rect.x, key.rect.y, key.rect.width, key.rect.height);
            this.ctx.strokeRect(key.rect.x, key.rect.y, key.rect.width, key.rect.height);
        })

        window.requestAnimationFrame(this.draw);
    }
}

class PianoKey {
    constructor(type, sound) {
        this.type = type;
        this.sound = sound;
        this.rect = null;

        if(this.type === "white") {
            this.base_color = new Color(255, 255, 255);
        }
        if(this.type === "black") {
            this.base_color = new Color(0, 0, 0);
        }

        this.color = this.base_color;
    }

    play(audio_ctx) {
        var buffer_node = new AudioBufferSourceNode(audio_ctx);
        buffer_node.buffer = this.sound;
        buffer_node.connect(audio_ctx.destination);
        buffer_node.start();

        this.color = new Color(255, 160, 122);
        this.color.fade(this.base_color, 800);
    }
}