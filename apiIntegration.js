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
            this.verticesData = await this.loadVerticesData();
            const htmlContainer = document.getElementById("images-container");
            for(let i = 0; i < this.templates.length; i++) {
                const div = document.createElement("div");
                const img = document.createElement("img");
                img.src = this.templates[i].imageUrl;
                img["data-id"] = i;

                div.appendChild(img);
                htmlContainer.appendChild(div);

                div.addEventListener("click", async (event) => {
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

            /*//Aquí inspeccionamos el modelo para ver todas las partes
            console.log("Modelo cargado:", referenceModel);
            referenceModel.traverse((child) => {
                console.log("Nombre:", child.name, "Tipo:", child.type);
            });*/

            this.referenceModels.push(referenceModel);

            this.referenceModels[0].traverse((child) => {
                if (child.isMesh) {
                  console.log("Mesh encontrada:", child.name);
                  console.log("Geometry:", child.geometry);
                  console.log("Attributes:", child.geometry.attributes);
                  console.log("Positions:", child.geometry.attributes.position);
                }
              });
              

            console.log("Referencia agregada:", modelId);
            //this.scene.add(referenceModel);
            //this.render();
        });
    }

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
                this.selectReferenceModel(template.id);
    
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

        // this.loader.load( 'https://api.readyplayer.me/v2/avatars/'+id+'.glb' + (preview ? "?preview=true" : ""), ( gltf ) => {
        this.loader.load( 'https://models.readyplayer.me/'+id+'.glb' + (preview ? "?preview=true" : ""), ( gltf ) => {

            //model visible
            if(!this.visibleModel) {
                this.scene.add(gltf.scene);
            }
            this.visibleModel = gltf.scene;
            this.render();
            return true;

        } );
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
        
        let morphMesh = this.getPart(this.visibleModel, "Wolf3D_Head");
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
            
            morphMesh.geometry.attributes.position.array = sourceVertices;
            morphMesh.geometry.attributes.position.needsUpdate = true;
            this.render();
        }
    }

    getPart(mesh, part) {
        if (!mesh) {
            console.error("Error: mesh es undefined", mesh);
            return null;
        }
    
        // Si el nombre de la mesh coincide con la parte, lo retornamos directamente
        if (mesh.name.includes(part)) return mesh;
    
        // Si tiene hijos, buscamos recursivamente
        if (mesh.children && mesh.children.length > 0) {
            for (let child of mesh.children) {
                let result = this.getPart(child, part);
                if (result) return result;
            }
        }

        // Si no se encontró nada
        console.warn(`No se encontró la parte '${part}' en el mesh`, mesh);
        return null;
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
        
        if (!morph.morphTargetInfluences) this.initializeTargets(morph, name);
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

    // End of funtions for INTERPOLATION between facial characteristics (morph targets)

    updateRendererSize() {
        const sidebarWidth = this.sidebar ? this.sidebar.offsetWidth : 0;
        this.renderer.setSize(window.innerWidth - sidebarWidth, window.innerHeight);
    }

    /*
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.render();
    }
    */

    render() {
        this.renderer.render( this.scene, this.camera );
    }
}

export {App};

const app = new App();
app.init();