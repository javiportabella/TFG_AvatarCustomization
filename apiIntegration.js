import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LX } from 'lexgui';

// Follow this tutorial: https://docs.readyplayer.me/ready-player-me/integration-guides/api-integration/quickstart
const SUBDOMAIN = 'oasis'; // your project name
const API_ID = '678787338a474ff75326a320';
let TOKEN = null;

class App {
    constructor(){
        // Initialize properties
        this.loader = new GLTFLoader();
        this.scene = null;
        this.area = null; // LX area for the sidebar
        this.templates = null;
        this.referenceModels = []; // Store reference models for interpolation
        this.verticesData = null; // Store verticesGlobal.json data
        this.preloadAvatarTemplates = [];
        this.parts = ["Nose", "Eyes", "Ears", "Jaw", "Chin"];
        this.partReferenceMap = {Nose: null, Eyes: null, Ears:null, Jaw: null, Chin: null}; // e.g. { Nose: model0, Eyes: model2, ... }
        this.debug = false; // Debug mode
        this.maskEyeTexture = new THREE.TextureLoader().load("models/maskEye.png");
        this.originalEyeTextureL = null;
        this.originalEyeTextureR = null;
        this.maps = {};
    }

    // Initialize the application
    async init(){

        // Create an anonymous user and obtain the access token required to access the API endpoints
        const data = await this.createAnonymousUser();

        if(data) {
            // Get access token from the response
            TOKEN = data.data.token;
            this.initScene();

            this.templates = await this.getAllTemplates();
            this.verticesData = await this.loadVerticesData(); //Load the JSON file with the vertices data
            const htmlContainer = document.getElementById("images-container");
            const urlParams = new URLSearchParams(window.location.search);
            this.debug = urlParams.get("debug");

            this.populateAvatarSelector(htmlContainer);

        }
        // Configurar el botón de retroceso para reiniciar la app
        const backButton = document.getElementById("back-button");
        backButton.onclick = () => {
            // Limpiar la escena si ya está inicializada
            if (this.scene && typeof this.scene.clear === "function") {
                this.scene.clear();
            }

            // Limpiar la sidebar
            this.area.root.innerHTML = "";

            // Vaciar variables globales
            //this.templates = null;
            this.referenceModels = [];
            this.partReferenceMap = {Nose: null, Eyes: null, Ears:null, Jaw: null, Chin: null};
            this.originalEyeTextureL = null;
            this.originalEyeTextureR = null;
            this.maps = {};

            // Limpiar el contenedor de imágenes
            const container = document.getElementById("images-container");
            container.innerHTML = "";

            // Ocultar el botón
            backButton.classList.add("hidden");

            // Reiniciar la app
            this.init();
        };
    }

    populateAvatarSelector(container) {
        container.innerHTML = ""; // Limpiar contenido anterior

        // Botón "+" para añadir avatar personalizado
        const plusDiv = document.createElement("div");
        plusDiv.classList.add("plus-wrapper");
        const plusButton = document.createElement("button");
        plusButton.innerText = "+";
        plusButton.onclick = () => this.showOwnAvatarDialog();
        plusDiv.appendChild(plusButton);
        container.appendChild(plusDiv);

        // Crear tarjetas para cada template
        this.templates.forEach((template, i) => {
            const div = document.createElement("div");
            const img = document.createElement("img");
            img.src = template.imageUrl;
            img.setAttribute("data-id", i);
            img.style.cursor = "pointer";

            img.addEventListener("click", async (event) => {
                // Show loading
                const loadingElement = document.getElementById("loading");
                loadingElement.classList.remove("hidden");
            
                try {
                    // We use the data-id attribute to get the index of the template 
                    // and then we get the template data from the templates array
                    const templateData = this.templates[event.target.getAttribute("data-id")];
                    let avatarId;
                    if (templateData.custom) {
                        // Si es personalizado, no hace falta pasar por assignTemplate
                        avatarId = templateData.id;
                    } else {
                        const template = await this.assignTemplate(templateData);
                        if (!template) return;
                        avatarId = template.id;
                    }

                    if (avatarId) {
                        await this.loadAvatar(avatarId, "preview");
                        container.classList.add("hidden");

                        if (this.templates) {
                            this.createSidebar();
                        } else {
                            console.error("Error: Could not load avatar templates.");
                        }
                    }
                } catch (error) {
                        console.error("Error loading avatar:", error);
                } finally {
                        // Hide loading
                        loadingElement.classList.add("hidden");
                }
            });

            div.appendChild(img);
            container.appendChild(div);
        });

        container.classList.remove("hidden");
        document.getElementById("back-button")?.classList.remove("hidden");
    }


    // Create an anonymous user to get access token
    async createAnonymousUser() { // Documentation: https://docs.readyplayer.me/ready-player-me/integration-guides/api-integration/quickstart#create-anonymous-user
        const response = await fetch('https://'+ SUBDOMAIN + '.readyplayer.me/api/users', {method: "POST"});
        try {
            if(response.ok) {
                return await response.json();
            }
            else {
                console.error(response.status + ": " + response.statusText);
            }
        }
        catch(error) {
            console.error(error);
        }
        return null;
    }

    // Fetch all available avatar templates
    async getAllTemplates() {
        const response = await fetch("https://api.readyplayer.me/v2/avatars/templates", {method: "GET", headers: {"Authorization": 'Bearer '+ TOKEN}});
        try {
            if(response.ok) {
                const data = await response.json(); //get list of templates
                return data.data;
            }
        }
        catch(err) {
            console.error(err);
        }JSON.stringify({"data":{ "partner": SUBDOMAIN, "bodyType": "fullbody" }})
    }

    // Assign a template to the user, generate a temporary avatar ID
    async assignTemplate(data) {
        // If it's a custom avatar, we don't call the API, we return the ID directly.
        if (data.custom) {
            return { id: data.id, url: data.customUrl};
        }

        if(!this.preloadAvatarTemplates[data.id]) {
            const requestOptions = {
                method: "POST",
                body: JSON.stringify({"data":{ "partner": SUBDOMAIN, "bodyType": "fullbody" }}),
                redirect: "follow",
                headers: {"Authorization": 'Bearer '+ TOKEN,
                    "content-type": "application/json"
                }
            };
    
            try {
                let response = await fetch("https://api.readyplayer.me/v2/avatars/templates/"+ data.id, requestOptions);
                let result = await response.json();
    
                // Create the avatar permanently
                requestOptions.method = "PUT";
                response = await fetch("https://api.readyplayer.me/v2/avatars/"+ result.data.id, requestOptions);
                this.preloadAvatarTemplates[data.id] = {id: result.data.id};
                return result.data;
                
            } catch (error) {
                console.error(error);
            };

        }
        return this.preloadAvatarTemplates[data.id];
    }

    // Load vertices data from external file
    async loadVerticesData() {
        try {
            const response = await fetch("ImportExportVertices/verticesGlobal.json");
            if (!response.ok) throw new Error("Cannot load verticesGlobal.json");
            return await response.json();
        } catch (error) {
            console.error("Error loading verticesGlobal.json:", error);
            return null;
        }
    }

    // Initialize the Three.js scene
    async initScene(){
        this.scene = new THREE.Scene();
        this.area = await LX.init({});
        
        // Set background image
        const bgTexture = new THREE.TextureLoader().load('filesUtiles/fondoplaya.avif');
        this.scene.background = bgTexture;

        this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 1000 );
        this.camera.position.set(0.2, 1.5, 0.7);
        
        this.renderer = new THREE.WebGLRenderer( );
		this.renderer.setPixelRatio( window.devicePixelRatio );
        this.updateRendererSize();
        
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.addEventListener( 'change', () => this.render() );
        this.controls.target.set( 0, 1.5, 0 );
        this.controls.minDistance = .4;
        this.controls.maxDistance = 10;
        this.controls.update();

        document.body.appendChild(this.renderer.domElement);
        window.addEventListener('resize', () => {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });

        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        this.scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(10, 10, 10);
        this.scene.add(pointLight);
        let dirLight = new THREE.DirectionalLight ( 0xffffff, 0.5 );
        dirLight.position.set( 3,5,3 );
        this.scene.add( dirLight );

        let ground = new THREE.Mesh( new THREE.PlaneGeometry( 300, 300 ), new THREE.MeshStandardMaterial( { color: 0x141414, depthWrite: true, roughness: 1, metalness: 0 } ) );
        ground.rotation.x = -Math.PI / 2;
        const gridHelper = new THREE.GridHelper( 10, 20, 0xffffff, 0xbbbbbb );
        this.scene.add( gridHelper );

        this.visibleModel = null; // visible model to the user
        this.hiddenModel = null; // model where the changes are applied

        this.render();
    }

    showOwnAvatarDialog() {
        let glbUrl = null;
        let avatarId = null;
        
        new LX.Dialog("Use your own avatar", p => {
            // Input de URL
            p.addText("RPM URL", null, (value) => {
                const match = value.match(/readyplayer\.me\/([\w\d-]+)/);
                if (glbUrl) {
                    LX.message("Please enter a URL OR upload a GLB file, not both.","Error");
                    return;
                }
                glbUrl = value;
                avatarId = match[1].replace(".glb", "");
            }, { placeholder: "https://models.readyplayer.me/{avatar_id}.glb" });


            // Input de archivo local
            p.addFile("Upload GLB", async (data, file) => {
                if (file && file.name.endsWith(".glb")) {
                    const blobURL = URL.createObjectURL(file);
                    if (glbUrl) {
                        LX.message("Please enter a URL OR upload a GLB file, not both.","Error");
                        return;
                    }
                    glbUrl = blobURL;
                    avatarId = file.name.replace(".glb", "");
                } else {
                    LX.message("Please upload a valid .glb file from Ready Player Me with its original name.","Error");
                }
            });

            // Botón Submit
            p.addButton(null, "Submit", async () => {
                if (!glbUrl) {
                    LX.message("Please enter a valid URL or upload a GLB file.","Error");
                    return;
                }
                

                // Crear el nuevo template
                const newTemplate = {
                    id: avatarId,
                    imageUrl: `https://models.readyplayer.me/${avatarId}.png`,
                    name: "Custom Avatar",
                    custom: true, // Flag to indicate this is a custom avatar
                    customUrl: glbUrl
                };

                if (this.templates.some(template => template.id === avatarId)) {
                    LX.message("This avatar already exists in the list.","Error");
                    return;
                }
                // Añadir al principio
                this.templates.unshift(newTemplate);

                // Volver a renderizar el selector de avatares
                const container = document.getElementById("images-container");
                container.innerHTML = ""; // limpiar
                this.populateAvatarSelector(container)
                
            });
        }, { modal: true });
    }



    updateRendererSize() {
        const sidebarWidth = this.sidebar ? this.sidebar.offsetWidth : 0;
        this.renderer.setSize(window.innerWidth - sidebarWidth, window.innerHeight);
    }

    render() {
        this.renderer.render( this.scene, this.camera );
    }

    // Create the sidebar UI (with collapsible sections)
    async createSidebar() {
        //const sidebarContainer = document.createElement('div');

        // To use classic dialogs as simple messages or error alerts, they can be also created using LX.message
      
        const sidebarContainer = this.area.root;
        sidebarContainer.id = "sidebar-container";
        sidebarContainer.style.width = '300px';
        document.body.appendChild(sidebarContainer);

        // Añadir botón para mostrar/ocultar sidebar
        const toggleBtn = document.createElement('img');
        //toggleBtn.id = "toggle-sidebar-btn";
        //toggleBtn.textContent = "☰"; // menú estilo hamburguesa
        toggleBtn.src = 'filesUtiles/sidebarIcon.png'; // Ruta del icono
        toggleBtn.alt = 'Toggle Sidebar';
        toggleBtn.id = 'sidebar-toggle-btn';

        // Comportamiento del botón
        toggleBtn.addEventListener("click", () => {
        sidebarContainer.style.display = sidebarContainer.style.display === "none" ? "block" : "none";
        });

        document.body.appendChild(toggleBtn);
        

    
        // Helper to create collapsible sections
        const createDropdown = (title) => {
            const section = document.createElement('div');
            section.style.marginBottom = '10px';
    
            const header = document.createElement('div');
            header.innerText = title;
            header.id = 'sidebar-headers';
            const content = document.createElement('div');
            content.style.display = 'none';
            content.style.padding = '10px';
    
            // Alternate visibility when clicking
            header.addEventListener('click', () => {
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            });
    
            section.appendChild(header);
            section.appendChild(content);
            sidebarContainer.appendChild(section);
    
            return content;
        };
    
        // ====== INTERPOLATION ======
        const interpolationContent = createDropdown('INTERPOLATION');
        this.createInterpolationPanel(interpolationContent);
    
        // ====== RECOLORING ======
        const recoloringContent = createDropdown('RECOLORING');
        this.createRecoloringPanel(recoloringContent);
    
        // ====== WRINKLE MAPS ======
        const wrinkleContent = createDropdown('WRINKLE MAPS');
        const wrinkleText = document.createElement('p');
        wrinkleText.innerText = 'Opciones de wrinkle maps aquí...';
        wrinkleContent.appendChild(wrinkleText);
    }

    // Load avatar GLB into the scene
    loadAvatar(id, preview) {

        const promise = new Promise(( resolve, reject ) => {

            const url = (typeof id === "object" && id.url) ? id.url : `https://models.readyplayer.me/${id}.glb${preview ? "?preview=true" : ""}`;
            this.loader.load(url, (gltf) => {
                if(!this.visibleModel) {
                    this.scene.add(gltf.scene);
                }
                this.visibleModel = gltf.scene;
                gltf.scene.getObjectByName("Wolf3D_Head").morphPartsInfo = {"Nose":[], "Chin": [], "Ears":[], "Jaw":[], "Eyes":[]}; //store each part which morphattribute it corresponds to 
    
                if (this.referenceModels.length > 0) {
                    this.createMorphTargets(this.referenceModels[this.referenceModels.length - 1]);
                }
                const eyeL = this.scene.getObjectByName("EyeLeft");
                const eyeR = this.scene.getObjectByName("EyeRight");
    
                if (eyeL && eyeR) {
                    this.originalEyeTextureL = eyeL.material.map;
                    this.originalEyeTextureR = eyeR.material.map;
                }
    
                this.render();
                resolve();
            });
        });

        return promise;
    }

    createInterpolationPanel(container) {
        container.innerHTML = ""; // Clear old content

        this.parts.forEach(async part => {
            const section = document.createElement("div");
            section.classList.add("interpolation-section");

            const toggle = document.createElement("details");
            toggle.classList.add("toggle");

            const summary = document.createElement("summary");
            summary.innerHTML = `<span>${part}</span> <span class="arrow">▼</span>`;
            toggle.appendChild(summary);

            const innerContent = document.createElement("div");
            innerContent.className = "interpolation-content";
            innerContent.style.display = "flex";
            innerContent.style.alignItems = "center";      // Centrado vertical
            innerContent.style.flexDirection = "column";   // Organiza verticalmente


            // Slider
            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = 0;
            slider.max = 1;
            slider.step = 0.01;
            slider.value = 0;
            slider.style.width = "100%";
            slider.addEventListener("input", (e) => {
                //this.updateMorphTarget(part, parseFloat(e.target.value));
                this.updateMorphTargetWithWeights(part, [parseFloat(e.target.value),0.0,0.0]);
            });
            //innerContent.appendChild(slider);

            const mapWrapper = document.createElement("div");
            mapWrapper.style.width = "200px";
            mapWrapper.style.height = "200px";
            mapWrapper.style.position = "relative"; // para evitar que se expanda
            mapWrapper.style.overflow = "hidden";  // asegura que no se desborde

            const map2Dpoints = [
                { name: "source", pos: [0.0,0.0] },
                { name: "model1", pos: [0.0,-1.0] },
                { name: "model2", pos: [-1,1] },
                { name: "model3", pos: [1,1] }
            ];

           
            const map = this.maps[part] = new LX.CanvasMap2D(map2Dpoints, (value, event) => {
                // Aplicar interpolación
                if (this.referenceModels.length < 3) {
                    LX.message(`Select ${3-this.referenceModels.length} more to use the Voronoi-diagram interpolation`,`Only ${this.referenceModels.length} avatars selected`); 
                    console.warn("Not enough reference models loaded for interpolation.");  
                    return;
                }
                else {
                    // Aplicar interpolación
                    this.updateMorphTargetWithWeights(part, [
                        value.model1,
                        value.model2,
                        value.model3
                    ]);
                    //console.log(value);
                }
            }, {circular:true, showNames:true, size:[200, 200]});

            // Asegura que el canvas se adapte al wrapper
            map.root.style.width = "100%";
            map.root.style.height = "100%";
            map.root.style.display = "block"; // elimina espacio extra  
            mapWrapper.appendChild(map.root);
            innerContent.appendChild(mapWrapper);

            // Template thumbnails
            const templateGrid = document.createElement("div");
            templateGrid.className = "reference-grid";
            templateGrid.style.display = 'grid';
            templateGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            templateGrid.style.gap = '10px';
            templateGrid.style.marginTop = '10px';

            this.templates.forEach((template, index) => {
                const div = document.createElement("div");
                const img = document.createElement("img");
                img.src = template.imageUrl;
                img.className = "model-img";
                img.style.width = "100%";
                img.style.height = '80px';
                img.style.objectFit = 'cover';
                img.style.cursor = "pointer";
                img.setAttribute("data-id", index);

                img.addEventListener("click", async (event) => {
                    const templateData = this.templates[event.target.getAttribute("data-id")];
                    const templateResult = await this.assignTemplate(templateData);

                    const alreadyLoaded = this.referenceModels.find(ref => ref.name === templateResult.id);
                    if (!alreadyLoaded) {
                        this.selectReferenceModel(templateResult.id,part);
                    } else {
                        console.log(`El modelo ${templateResult.id} ya está cargado como referencia.`);
                    }

                    // Assign the selected model to this specific part
                    this.partReferenceMap[part] = templateResult.id;

                    // Visually highlight selected image
                    Array.from(templateGrid.getElementsByTagName('img')).forEach(image => {
                        image.style.border = '';
                        image.style.borderRadius = '';
                    });

                    img.style.border = '4px solid rgb(16, 70, 120)';
                    img.style.borderRadius = '12px';
                });

                div.appendChild(img);
                templateGrid.appendChild(div);
            });

            innerContent.appendChild(templateGrid);
            toggle.appendChild(innerContent);
            section.appendChild(toggle);
            container.appendChild(section);

            // Flecha animada
            summary.addEventListener("click", () => {
                setTimeout(() => {
                    const arrow = summary.querySelector(".arrow");
                    arrow.textContent = toggle.open ? "▲" : "▼";
                }, 100);
            });
        });
    }

    // Load a reference model for interpolation
    async selectReferenceModel(modelId, part=null) {
        // Prevent loading if already loaded
        const alreadyLoaded = this.referenceModels.find(ref => ref.userData.modelId === modelId);
        if (alreadyLoaded) {
            console.log("Reference model already loaded:", modelId);
            this.createMorphTargets(alreadyLoaded, part);
            return;
        }
    
        this.loader.load('https://api.readyplayer.me/v2/avatars/' + modelId + '.glb', (gltf) => {
            const referenceModel = gltf.scene;
            referenceModel.userData.modelId = modelId; // Guardamos el ID para evitar duplicados
            referenceModel.name = "Reference_" + modelId;
    
            this.referenceModels.push(referenceModel);
    
            if (this.referenceModels.length >= 3) {
                console.log("Simulando morph targets para 3 modelos...");
                this.createMorphTargets(this.referenceModels[0]);
                this.createMorphTargets(this.referenceModels[1]);
                this.createMorphTargets(this.referenceModels[2]);
            } else {
                this.createMorphTargets(referenceModel);
            }    
            console.log("Reference model added:", modelId);
        });
    }

    // Create morph targets using the vertex of the reference model -> to use in loadAvatar() and selectReferenceModel() 
    createMorphTargets(referenceModel) {
        const referenceHead = referenceModel.getObjectByName("Wolf3D_Head");
        const visibleHead = this.visibleModel?.getObjectByName("Wolf3D_Head");

        if (!referenceHead || !visibleHead) {
            console.warn("Missing head meshes for morph targets.");
            return;
        }

        const parts = this.parts || ["Nose", "Eyes", "Ears", "Jaw", "Chin"];

        parts.forEach(part => {
            if (this.verticesData[part]) {
                const existing = visibleHead.morphPartsInfo[part] || [];
                if (!existing.some(entry => entry.character === referenceModel.name)) {
                    this.addMorph(referenceHead, this.verticesData[part], part, referenceModel.name);
                }
            }
        });
    }


    // Initialize morph targets if they do not exist yet
    initializeMorphTargets(headMesh) {
        // Check if the mesh has morph targets and initialize them if not
        if (!headMesh.morphTargetInfluences) {
            headMesh.morphTargetInfluences = [];
            headMesh.morphTargetDictionary = {};
            
            this.parts.forEach(part => {
                if (!headMesh.morphTargetDictionary[part]) {
                    headMesh.morphTargetDictionary[part] = headMesh.morphTargetInfluences.length;
                    headMesh.morphTargetInfluences.push(0);
                }
            });
            
            if (!headMesh.geometry.morphAttributes) {
                headMesh.geometry.morphAttributes = {
                    position: [],
                    normal: []
                };
            }
        }
    }

    // Update morph target influences for a facial part
    updateMorphTarget(part, value) {
        if (!this.verticesData || !this.verticesData[part]) {
            console.warn(`No vertices data for ${part}`);
            return;
        }
        
        let morphMesh = this.visibleModel.getObjectByName("Wolf3D_Head");
        if (!morphMesh) {
            console.warn(`'Wolf3D_Head' not found`);
            return;
        }

        if (morphMesh.morphTargetInfluences === undefined) {
            this.initializeMorphTargets(morphMesh);
        }


        const morphIndex = morphMesh.morphTargetDictionary[part + "0"];
        morphMesh.morphTargetInfluences[morphIndex] = value;

        morphMesh.geometry.attributes.position.needsUpdate = true;
        morphMesh.geometry.computeVertexNormals();

        this.render();
    } 

    updateMorphTargetWithWeights(part, weights) {
        if (!this.visibleModel || !this.visibleModel.getObjectByName("Wolf3D_Head")) {
            console.warn("Head mesh not found.");
            return;
        }

        const morphMesh = this.visibleModel.getObjectByName("Wolf3D_Head");
        const morphParts = morphMesh.morphPartsInfo?.[part];

        if (!morphParts || morphParts.length < weights.length) {
            console.warn(`Not enough morph targets for part: ${part}`);
            const morphIndex = morphMesh.morphTargetDictionary[part + "0"];
            morphMesh.morphTargetInfluences[morphIndex] = weights[0];
            
            morphMesh.geometry.attributes.position.needsUpdate = true;
            morphMesh.geometry.computeVertexNormals();

            this.render();
        } else{
            // Reinicia todas las influencias de la parte
            morphParts.forEach(entry => {
                morphMesh.morphTargetInfluences[entry.id] = 0;
            });

            // Aplica los nuevos pesos a cada morph target
            for (let i = 0; i < weights.length; i++) {
                const entry = morphParts[i];
                if (entry) {
                    morphMesh.morphTargetInfluences[entry.id] = weights[i];
                }
            }

            this.render();
        }


    }


    // Add a new morph target to the head mesh
    addMorph(target, vertices, code, sel_name){
        const morph = this.scene.getObjectByName("Wolf3D_Head");

        // Get base attributes
        const sourceAttr = morph.geometry.attributes.position;
        const targetAttr = target.geometry.attributes.position;

        const stride = sourceAttr.data.stride;

        // Generate new morphed array from source + target at selected vertices
        const { res: delta_p } = this.morphArray(sourceAttr, targetAttr, vertices, stride);

        let name = code + morph.morphPartsInfo[code].length;
        
        if (!morph.morphTargetInfluences) this.initializeMorphTargets(morph, name);
        morph.morphTargetDictionary[name] = morph.morphTargetInfluences.length;
        morph.morphTargetInfluences.push(0);

        // Store the info about which part this morph belongs to
        morph.morphPartsInfo[code].push({ id: morph.morphTargetInfluences.length - 1, character: sel_name });

        // Create a new Float32BufferAttribute for the interpolated positions
        const mt_p = new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(delta_p,stride), 3, 0);
        
        // Add the newly generated morph target
        morph.geometry.morphAttributes.position.push(mt_p);

        //const mt_n = new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Float32Array(delta_p.length).fill(0),stride), 3, 0);
        //morph.geometry.morphAttributes.normal.push(mt_n); //We do not need to add the normals, as we are working with InterleavedBufferAttributes and there is no need to recalculate them


        // debug
        if (this.debug) {
            let geometry = new THREE.BufferGeometry();
            geometry.setAttribute( 'position', morph.geometry.attributes.position);
            console.log("Morph:", morph.geometry.getIndex());
            geometry.setIndex(morph.geometry.getIndex());
            let material = new THREE.MeshStandardMaterial( { color: "green", wireframe: true } );
            let mesh = new THREE.Mesh( geometry, material );
            mesh.position.x = 0.5;
            mesh.name = "source";
            this.scene.add(mesh);
    
            const geometry_t = new THREE.BufferGeometry();
            geometry_t.setAttribute( 'position', target.geometry.attributes.position);
            console.log("Target:", target.geometry.getIndex());
            geometry_t.setIndex(target.geometry.getIndex());
    
            const material_t = new THREE.MeshStandardMaterial( { color: "red", wireframe: true } );
            mesh = new THREE.Mesh( geometry_t, material_t );
            mesh.position.x = 0.8;
            mesh.name = "target";
            this.scene.add(mesh);
    
            const geometry_r = new THREE.BufferGeometry();
            geometry_r.setAttribute( 'position', mt_p);
            geometry_r.setIndex(morph.geometry.getIndex());
            const material_r = new THREE.MeshStandardMaterial( { color: "blue", wireframe: true } );
            mesh = new THREE.Mesh( geometry_r, material_r );
            mesh.position.x = 0.5;
            mesh.name = "result";
            this.scene.add(mesh);
        }

        return {mph: morph, helper_sliders: null};
    }

    // Compute the center of a vertex array
    // This function is used to calculate the center of the vertices in the geometry to obtain the relative position of the morph targets
    computeCenter(array, stride) {
        const center = new THREE.Vector3();
        const count = array.length / stride;
    
        for (let i = 0; i < array.length; i += stride) {
            center.x += array[i];
            center.y += array[i + 1];
            center.z += array[i + 2];
        }
        center.divideScalar(count);
        return center;
    } 

    // Generate a morph array combining source and target vertices
    morphArray(source, target, vertices, stride) {
        const sourceArray = source.array;
        const targetArray = target.array;
        const count = source.count; // Number of vertices in the geometry
    
        const deltaArray = new Float32Array(count * stride).fill(0);

        // Compute the center of the source and target arrays as a reference point
        const sourceCenter = this.computeCenter(sourceArray, stride);
        const targetCenter = this.computeCenter(targetArray, stride);
    
        for (const indexArray of Object.values(vertices)) {
            for (const index of indexArray) {
                const i = index * stride; // Calculate the offset for the vertex
                
                // POSICIÓN (relativa al centro)
                const sx = sourceArray[i]     - sourceCenter.x;
                const sy = sourceArray[i + 1] - sourceCenter.y;
                const sz = sourceArray[i + 2] - sourceCenter.z;

                const tx = targetArray[i]     - targetCenter.x;
                const ty = targetArray[i + 1] - targetCenter.y;
                const tz = targetArray[i + 2] - targetCenter.z;

                deltaArray[i]     = tx - sx;
                deltaArray[i + 1] = ty - sy;
                deltaArray[i + 2] = tz - sz;

                // RESTO DEL STRIDE: diferencia directa
                for (let j = 3; j < stride; j++) {
                    deltaArray[i + j] = targetArray[i + j] - sourceArray[i + j];
                }
            }
        }
    
        return { res: deltaArray, dis: null };
    }  
    
    // Function to handle recoloring
    createRecoloringPanel(container) {
        const partsRec = [
            {
                name: "Skin",
                objectName1: "Wolf3D_Head",
                objectName2: "Wolf3D_Body",
                colors: ["#f4c1a1", "#d4a17a", "#e0ac69", "#c68642", "#472000"]
            },
            {
                name: "Eyes",
                objectName1: "EyeLeft",
                objectName2: "EyeRight",
                colors: ["#5579CF", "#55795C", "#8d5524", "#5e503f", "#000000"]
            },
            {
                name: "Hair",
                objectName: "Wolf3D_Hair",
                colors: ["#1A1A1A", "#774936", "#b87333", "#AE9819", "#999999"]
            },
            {
                name: "Top",
                objectName: "Wolf3D_Outfit_Top",
                colors: ["#5f5f5f", "#9e2a2b", "#6266DA", "#f4a261", "#256024"]
            },
            {
                name: "Bottom",
                objectName: "Wolf3D_Outfit_Bottom",
                colors: ["#5f5f5f", "#9e2a2b", "#1B3764", "#f4a261", "#256024"]
            },
            {
                name: "Shoes",
                objectName: "Wolf3D_Outfit_Footwear",
                colors: ["#2B2B2B", "#B158AF", "#2A5129", "#2b2d42", "#520000"]
            }
        ];
    
        container.innerHTML = ""; // Clear previous
    
        partsRec.forEach(part => {
            const section = document.createElement("div");
            section.classList.add("recoloring-section");
    
            const toggle = document.createElement("details");
            toggle.classList.add("toggle");
    
            const summary = document.createElement("summary");
            summary.innerHTML = `<span>${part.name}</span> <span class="arrow">▼</span>`;
            toggle.appendChild(summary);
    
            const colorContainer = document.createElement("div");
            colorContainer.className = "color-container";
    
            // Swatches
            part.colors.forEach(color => {
                const swatch = document.createElement("div");
                swatch.className = "color-swatch";
                swatch.style.backgroundColor = color;
                swatch.addEventListener("click", () => this.applyColorToPart(part, color));
                colorContainer.appendChild(swatch);
            });
    
            // Custom color picker
            const pickerLabel = document.createElement("label");
            pickerLabel.innerText = "Personalized color:";
            pickerLabel.style.color = "black";
            pickerLabel.style.display = "block";
            pickerLabel.style.marginTop = "8px";
            pickerLabel.style.fontSize = "12px";
    
            const colorInput = document.createElement("input");
            colorInput.type = "color";
            colorInput.addEventListener("input", (e) => this.applyColorToPart(part, e.target.value));
    
            pickerLabel.appendChild(colorInput);
            colorContainer.appendChild(pickerLabel);
    
            toggle.appendChild(colorContainer);
            section.appendChild(toggle);
            container.appendChild(section);
    
            // Flecha animada
            summary.addEventListener("click", () => {
                setTimeout(() => {
                    const arrow = summary.querySelector(".arrow");
                    arrow.textContent = toggle.open ? "▲" : "▼";
                }, 100);
            });
        });
    }
    
    // Apply color to a part of the avatar
    applyColorToPart(part, color) {
        const textureLoader = new THREE.TextureLoader();

        // Define ruta a textura neutral si aplica
        const texturePaths = {
            Hair: "./models/whiteHair.png",
            Top: "./models/whiteShirt.png",
            Bottom: "./models/whitePants.png",
            Shoes: "./models/whiteShoes.png",
            Skin: "./models/whiteSkin.png"
        };

        const applyToMesh = (mesh, texturePath) => {
            if (!mesh) return;
            if (texturePath) {
                textureLoader.load(texturePath, (neutralTex) => {
                    neutralTex.encoding = THREE.sRGBEncoding;
                    mesh.material = new THREE.MeshStandardMaterial({
                        map: neutralTex,
                        color: new THREE.Color(color)
                    });
                    this.renderer.render(this.scene, this.camera);
                });
            } else {
                // Solo color si no hay textura definida
                mesh.material.color.set(color);
                this.renderer.render(this.scene, this.camera);
            }
        };

        const texPath = texturePaths[part.name] || null;

        if (part.name === "Eyes") {
            const meshL = this.scene.getObjectByName(part.objectName1); 
            const meshR = this.scene.getObjectByName(part.objectName2);
            if (meshL && meshR) {
                const shaderMatL = this.createEyeShaderMaterial(this.originalEyeTextureL, this.maskEyeTexture, color);
                const shaderMatR = this.createEyeShaderMaterial(this.originalEyeTextureR, this.maskEyeTexture, color);

                meshL.material = shaderMatL;
                meshR.material = shaderMatR;

                this.renderer.render(this.scene, this.camera);
            }

        } else if (part.objectName) {
            const mesh = this.scene.getObjectByName(part.objectName);
            applyToMesh(mesh, texPath);
        } else if (part.objectName1 && part.objectName2) {
            const mesh1 = this.scene.getObjectByName(part.objectName1);
            const mesh2 = this.scene.getObjectByName(part.objectName2);
            applyToMesh(mesh1, "./models/whiteFace.png");
            applyToMesh(mesh2, texPath);
        }
    }

    
    
    createEyeShaderMaterial(baseTexture, maskTexture, colorHex) {
        const color = new THREE.Color(colorHex);
    
        return new THREE.ShaderMaterial({
            uniforms: {
                baseMap: { value: baseTexture },
                maskMap: { value: maskTexture },
                colorTint: { value: color }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D baseMap;
                uniform sampler2D maskMap;
                uniform vec3 colorTint;
                varying vec2 vUv;
    
                void main() {
                    vec4 base = texture2D(baseMap, vUv);
                    float mask = texture2D(maskMap, vUv).r;
                    vec3 tinted = mix(base.rgb, colorTint, mask);
                    tinted = min(tinted * 1.5, vec3(1.0)); // Brighten the tint by multiplying by 1.5
                    gl_FragColor = vec4(tinted, base.a);
                }
            `,
        });
    }
    
    

}

export {App};

const app = new App();
app.init();