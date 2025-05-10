import * as THREE from 'three';

// Crear material shader para recolorear ojos con máscara
export function createEyeRecoloringMaterial(tintColorHex, baseTexturePath, maskTexturePath) {
    const loader = new THREE.TextureLoader();

    const baseTexture = loader.load(baseTexturePath);
    const maskTexture = loader.load(maskTexturePath);
    const tintColor = new THREE.Color(tintColorHex);

    return new THREE.ShaderMaterial({
        uniforms: {
            baseMap: { value: baseTexture },
            maskMap: { value: maskTexture },
            tintColor: { value: tintColor }
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
            uniform vec3 tintColor;
            varying vec2 vUv;

            void main() {
                vec4 baseColor = texture2D(baseMap, vUv);
                float mask = texture2D(maskMap, vUv).r;
                vec3 finalColor = mix(baseColor.rgb, baseColor.rgb * tintColor, mask);
                gl_FragColor = vec4(finalColor, baseColor.a);
            }
        `,
        transparent: true
    });
}

