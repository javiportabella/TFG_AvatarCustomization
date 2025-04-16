import { GUI } from "./gui.js";

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Follow this tutorial: https://docs.readyplayer.me/ready-player-me/integration-guides/api-integration/quickstart
const SUBDOMAIN = 'oasis'; // your project name
const API_ID = '678787338a474ff75326a320';
let TOKEN = null;

class App {
    constructor(){
        this.gui = new GUI();
        this.loader = new GLTFLoader();
        this.templates = null;
        this.referenceModels = []; // Para almacenar modelos de referencia para interpolación
        this.verticesData = null; // Para almacenar los datos de verticesGlobal.json
        this.preloadAvatarTemplates = [];
    }

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
            for(let i = 0; i < this.templates.length; i++) {
                const div = document.createElement("div");
                const img = document.createElement("img");
                img.src = this.templates[i].imageUrl;
                img["data-id"] = i;

                div.appendChild(img);
                htmlContainer.appendChild(div);

                div.addEventListener("click", async (event) => {
                    // We use the data-id attribute to get the index of the template 
                    // and then we get the template data from the templates array
                    const templateData = this.templates[event.target["data-id"]];
                    const template = await this.assignTemplate(templateData);
                    if(template) {
                        this.loadAvatar(template.id, "preview");
                        htmlContainer.classList.add("hidden");
                    }
                })
                
            }
            htmlContainer.classList.remove("hidden");
            if (this.templates) {
                this.createSidebar(); // createSidebar solo se llama si templates está cargado
            } else {
                console.error("Error: No se pudieron cargar las plantillas de avatares.");
            }
        }
        
    }

    async selectReferenceModel(modelId) {

        this.loader.load('https://api.readyplayer.me/v2/avatars/'+modelId+'.glb', (gltf) => {
            const referenceModel = gltf.scene;

            this.referenceModels.push(referenceModel);
            console.log("Referencia agregada:", modelId);
            //this.scene.add(referenceModel);
            //this.render();
        });
    }

    // Funció per crear la sidebar amb tres seccions desplegables: Interpolation, Recoloring i Wrinkle Maps.
    createSidebar() {
        // Crear el contenedor de la sidebar
        const sidebarContainer = document.createElement('div');
        sidebarContainer.style.position = 'absolute';
        sidebarContainer.style.right = '0';
        sidebarContainer.style.top = '0';
        sidebarContainer.style.width = '300px';
        sidebarContainer.style.height = '100%';
        sidebarContainer.style.backgroundColor = 'rgba(139, 139, 139, 0.7)';
        sidebarContainer.style.overflow = 'auto';
        sidebarContainer.style.padding = '10px';
        sidebarContainer.style.boxShadow = '0px 0px 10px rgba(0,0,0,0.3)';
        document.body.appendChild(sidebarContainer);
    
        // Función para crear un desplegable
        const createDropdown = (title) => {
            const section = document.createElement('div');
            section.style.marginBottom = '10px';
    
            const header = document.createElement('div');
            header.innerText = title;
            header.style.backgroundColor = 'rgb(16, 70, 120)';
            header.style.color = 'white';
            header.style.padding = '10px';
            header.style.cursor = 'pointer';
            header.style.borderRadius = '5px';
            header.style.textAlign = 'center';
    
            const content = document.createElement('div');
            content.style.display = 'none';
            content.style.padding = '10px';
    
            // Alternar visibilidad al hacer clic
            header.addEventListener('click', () => {
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            });
    
            section.appendChild(header);
            section.appendChild(content);
            sidebarContainer.appendChild(section);
    
            return content;
        };
    
        // ====== INTERPOLATION ======
        const interpolationContent = createDropdown('Interpolation');
    
        // Sliders
        const parts = ["Nose", "Eyes", "Ears", "Jaw", "Chin"];
        parts.forEach(part => {
            let label = document.createElement('label');
            label.innerText = `${part}`;
            label.style.color = 'black';
            label.style.margin = '4%';
    
            let slider = document.createElement('input');
            slider.type = 'range';
            slider.style.width = '100%';
            slider.min = 0;
            slider.max = 1;
            slider.step = 0.01;
            slider.value = 0;
    
            slider.addEventListener('input', (event) => {
                this.updateMorphTarget(part, parseFloat(event.target.value));
            });
    
            interpolationContent.appendChild(label);
            interpolationContent.appendChild(slider);
        });
    
        // Contenedor de selección de modelos
        const referenceContainer = document.createElement('div');
        referenceContainer.style.display = 'grid';
        referenceContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        referenceContainer.style.gap = '10px';
        referenceContainer.style.marginTop = '10px';
        interpolationContent.appendChild(referenceContainer);
    
        this.templates.forEach((template, index) => {
            const div = document.createElement("div");
            const img = document.createElement("img");
            img.src = template.imageUrl;
            img.style.width = "100%";
            img.style.height = '80px';
            img.style.objectFit = 'cover';
            img.style.cursor = "pointer";
            img.setAttribute("data-id", index);
    
            img.addEventListener('click', async (event) => {
                const templateData = this.templates[event.target.getAttribute("data-id")];
                const template = await this.assignTemplate(templateData);
                    
                // Comprobar si ya existe en referenceModels
                const alreadyLoaded = this.referenceModels.find(ref => ref.name === template.id);
                if (!alreadyLoaded) {
                    this.selectReferenceModel(template.id);
                } else {
                    console.log(`El modelo ${template.id} ya está cargado como referencia.`);
                }
    
                // Resaltar la imagen seleccionada
                const allImages = referenceContainer.getElementsByTagName('img');
                Array.from(allImages).forEach(image => {
                    image.style.border = '';
                    image.style.borderRadius = '';
                });
    
                img.style.border = '4px solid rgb(16, 70, 120)';
                img.style.borderRadius = '12px';
            });
    
            div.appendChild(img);
            referenceContainer.appendChild(div);
        });
    
        // ====== RECOLORING ======
        const recoloringContent = createDropdown('Recoloring');
        const recoloringText = document.createElement('p');
        recoloringText.innerText = 'Opciones de recoloring aquí...';
        recoloringContent.appendChild(recoloringText);
    
        // ====== WRINKLE MAPS ======
        const wrinkleContent = createDropdown('Wrinkle Maps');
        const wrinkleText = document.createElement('p');
        wrinkleText.innerText = 'Opciones de wrinkle maps aquí...';
        wrinkleContent.appendChild(wrinkleText);
    }
    


    // Create an anonymous user for your application to get a token
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

    async assignTemplate(data) {

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

    async initScene(){
        this.scene = new THREE.Scene();
        //this.scene.background = new THREE.Color( 0x1a1a1a );
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

        this.visibleModel = null; // model visible al usuari
        this.hiddenModel = null; // model on s'apliquen els canvis

        this.render();
    }

    loadAvatar(id, preview) {
        this.loader.load('https://models.readyplayer.me/'+id+'.glb' + (preview ? "?preview=true" : ""), (gltf) => {
            //model visible
            if(!this.visibleModel) {
                this.scene.add(gltf.scene);
            }
            this.visibleModel = gltf.scene;
            
            // Buscar la malla de la cabeza
            const headMesh = this.getPart(this.visibleModel, "Wolf3D_Head");
            
            if (headMesh && this.referenceModels.length > 0) {
                // Obtener la malla de referencia
                const referenceHead = this.getPart(this.referenceModels[0], "Wolf3D_Head");
                
                if (referenceHead) {
                    // Añadir morph targets para cada parte
                    const parts = ["Nose", "Eyes", "Ears", "Jaw", "Chin"];
                    parts.forEach(part => {
                        if (this.verticesData[part]) {
                            this.addMorph(
                                referenceHead, 
                                this.verticesData[part], 
                                part, 
                                [part], 
                                `Reference_${part}`
                            );
                        }
                    });
                }
            }
            
            this.render();
            return true;
        });
    }

    initializeMorphTargets(headMesh) {
        // Verifica si ya tiene morph targets inicializados
        if (!headMesh.morphTargetInfluences) {
            headMesh.morphTargetInfluences = [];
            headMesh.morphTargetDictionary = {};
            
            // Inicializa los morph targets para cada parte
            const parts = ["Nose", "Eyes", "Ears", "Jaw", "Chin"];
            parts.forEach(part => {
                if (!headMesh.morphTargetDictionary[part]) {
                    headMesh.morphTargetDictionary[part] = headMesh.morphTargetInfluences.length;
                    headMesh.morphTargetInfluences.push(0);
                }
            });
            
            // Asegúrate de que la geometría tenga los atributos necesarios
            if (!headMesh.geometry.morphAttributes) {
                headMesh.geometry.morphAttributes = {
                    position: [],
                    normal: []
                };
            }
        }
    }

    // Functions for INTERPOLATION between facial characteristics (morph targets)

    async loadVerticesData() {
        try {
            const response = await fetch("ImportExportVertices/verticesGlobal.json");
            if (!response.ok) throw new Error("No se pudo cargar verticesGlobal.json");
            return await response.json();
        } catch (error) {
            console.error("Error cargando verticesGlobal.json:", error);
            return null;
        }
    }

    //fn para añadir la logica de interpolación
    updateMorphTarget(part, value) {
        if (!this.verticesData || !this.verticesData[part]) {
            console.warn(`No hay datos de vértices para ${part}`);
            return;
        }
        
        //we need to get the mesh from the visible model
        let morphMesh = this.visibleModel.getObjectByName("Wolf3D_Head");
        if (!morphMesh) {
            console.warn(`'Wolf3D_Head' no se ha encontrado`);
            return;
        }

        // Configuramos el morph target si no está inicializado
        if (morphMesh.morphTargetInfluences === undefined) {
            this.initializeMorphTargets(morphMesh);
        }

        let morphIndex = morphMesh.morphTargetDictionary[part];
        if (morphIndex !== undefined) {
            const sourceVertices = morphMesh.geometry.attributes.position.array.slice();
            const targetMesh = this.referenceModels[0]; // Usa el primer modelo de referencia cargado
            
            if (!targetMesh) {
                console.warn("No hay modelo de referencia para interpolar");
                return;
            }
            
            const targetVertices = targetMesh.geometry.attributes.position.array;
            const affectedVertices = this.verticesData[part];
            console.log(`Affected Vertices: ${affectedVertices}`);
            
            for (let i of affectedVertices) {
                sourceVertices[i * 3] = (1 - value) * sourceVertices[i * 3] + value * targetVertices[i * 3];
                sourceVertices[i * 3 + 1] = (1 - value) * sourceVertices[i * 3 + 1] + value * targetVertices[i * 3 + 1];
                sourceVertices[i * 3 + 2] = (1 - value) * sourceVertices[i * 3 + 2] + value * targetVertices[i * 3 + 2];
            }
            //we update the mesh with the new vertices
            morphMesh.geometry.attributes.position.setArray(sourceVertices); //crec que és el mateix però era per probar
            //morphMesh.geometry.attributes.position.array = sourceVertices;
            morphMesh.geometry.attributes.position.needsUpdate = true;
            this.render();
        }
    }

    /*getPart(mesh, part) {
        if (!mesh) {
            console.error("Error: mesh es undefined");
            return null;
        }
        
        // Usamos getObjectByName para buscar directamente el objeto
        const found = mesh.getObjectByName(part);
        if (found) return found;
        
        // Si no se encontró, buscamos en los hijos (por si el nombre no está exacto)
        for (let child of mesh.children) {
            const result = this.getPart(child, part);
            if (result) return result;
        }
        
        console.warn(`No se encontró la parte '${part}' en el mesh`, mesh);
        return null;
    }*/
    getPart(mesh, part) {
        return mesh.getObjectByName(part);
    }    

    addMorph(target, vertices, code, type, sel_name){
        let morph_idx = this.scene.children.findIndex(obj => obj.name.includes("Blend"));
        let morph = this.scene.children[morph_idx];
        morph = this.getPart(morph, "Wolf3D_Head");
        let face = morph;

        let source_p = new THREE.Float32BufferAttribute(morph.geometry.attributes.position.array, 3);
        let source_n = new THREE.Float32BufferAttribute(morph.geometry.attributes.normal.array, 3);
        let target_p = new THREE.Float32BufferAttribute(target.geometry.attributes.position.array, 3);

        let name = code + morph.morphPartsInfo[code].length;
        
        if (!morph.morphTargetInfluences) this.initializeMorphTargets(morph, name);
        else {
            morph.morphTargetDictionary[morph.morphTargetInfluences.length] = name;
            morph.morphTargetInfluences.push(0);
        }
        
        morph.morphPartsInfo[code].push({id : morph.morphTargetInfluences.length, character: sel_name});
        let combined = this.morphArray(source_p, target_p, vertices, type);
        let mixed_p = combined.res;
        let mt_p = new THREE.Float32BufferAttribute(mixed_p, 3);

        morph.geometry.morphAttributes.position.push(mt_p);
        morph.geometry.morphAttributes.normal.push(source_n);

        morph = this.scene.children[morph_idx];
        let helper_sliders;

        this.scene.remove(morph);
        this.scene.add(morph);
        return {mph: face, helper_sliders: helper_sliders};
    }

    // Funció per modificar un array de posicions: modifica els vèrtexs en funció dels índexs
    morphArray(source, target, indices, type) {
        let parts_dict = {
            "Nose": 3882,
            "Chin": 3878,
            "L_ear": 3847,
            "R_ear": 1504,
            "R_jaw": 1219,
            "L_jaw": 4344,
            "L_eye": 3048,
            "R_eye": 904
        };
        
        source = source.array;
        target = target.array;
        let final_dis = {};
        
        for (let i = 0; i < type.length; i++) {
            const type_i = type[i];
            const indices_i = indices[type_i];
            let dis = this.getIdxDisp_simple(source, target, parts_dict[type_i]);
            final_dis[type_i] = dis;
            
            for (let j = 0; j < indices_i.length; j++) {
                const index = indices_i[j] * 3; // Utilitzem variable 'j' per evitar conflictes
                source[index] = target[index] + dis.dx;
                source[index + 1] = target[index + 1] + dis.dy;
                source[index + 2] = target[index + 2] + dis.dz;
            }
        }
        
        return { res: source, dis: final_dis };
    }

    // Funció per calcular el desplaçament entre el source i target per un índex donat
    getIdxDisp_simple(source, target, index) {
        const i = index * 3;
        return { 
            dx: source[i] - target[i], 
            dy: source[i + 1] - target[i + 1], 
            dz: source[i + 2] - target[i + 2] 
        };
    }


    // End of funtions for INTERPOLATION between facial characteristics (morph targets)

    updateRendererSize() {
        const sidebarWidth = this.sidebar ? this.sidebar.offsetWidth : 0;
        this.renderer.setSize(window.innerWidth - sidebarWidth, window.innerHeight);
    }

    render() {
        this.renderer.render( this.scene, this.camera );
    }
}

export {App};

const app = new App();
app.init();