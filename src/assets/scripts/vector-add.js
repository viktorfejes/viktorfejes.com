class VectorAdd extends HTMLElement {
    constructor() {
        super();

        this.bounds = {
            x: -10,
            y: -8,
            width: 20,
            height: 16 
        };

        this.vectorA = {
            key: "vectorA",
            handleId: "handle-a",
            vectorId: "vector-a",
            labelId: "label-a",
            labelDist: 0.6,
            pos: { x: 4, y: 2 },
        };

        this.vectorB = {
            key: "vectorB",
            handleId: "handle-b",
            vectorId: "vector-b",
            labelId: "label-b",
            labelDist: 0.6,
            pos: { x: -2, y: 3 },
        };

        this.vectorC = {
            key: "vectorC",
            handleId: "handle-c",
            vectorId: "vector-c",
            labelId: "label-c",
            labelDist: 1.25,
            pos: { x: 2, y: 5 },
        };
    }

    connectedCallback() {
        const shadow = this.attachShadow({ mode: "open" });
        this.updateVectorSum();
        this.render();
        this.setupInteraction();
    }

    calculateLabelPosition(x1, y1, x2, y2, offsetDistance) {
        // Calculate midpoint of the line
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        // Calculate the angle of the line in rads
        const angleRad = Math.atan2(y2 - y1, x2 - x1);

        // Calculate the offset in X and Y dirs to move the text perpendicula to the line
        const offsetX = offsetDistance * Math.cos(angleRad - Math.PI / 2);
        const offsetY = offsetDistance * Math.sin(angleRad - Math.PI / 2);

        return {
            x: midX + offsetX,
            y: -(midY + offsetY)
        };
    }

    render() {
        const shadow = this.shadowRoot;
        const isDark = document.querySelector("html").classList.contains("dark");

        const colors = {
            background: isDark ? "#030712" : "#fff",
            grid: isDark ? "#111827" : "#f5f5f5",
            axis: isDark ? "#1f2937" : "#525252",
            vectorA: isDark ? "#38bdf8" : "#38bdf8",
            vectorB: isDark ? "#fb7185" : "#fb7185",
            vectorC: isDark ? "#fb7185" : "#a3e635",
        };

        const vectorALabelPos = this.calculateLabelPosition(0, 0, this.vectorA.pos.x, this.vectorA.pos.y, this.vectorA.labelDist);
        const vectorBLabelPos = this.calculateLabelPosition(0, 0, this.vectorB.pos.x, this.vectorB.pos.y, this.vectorB.labelDist);
        const vectorCLabelPos = this.calculateLabelPosition(0, 0, this.vectorC.pos.x, this.vectorC.pos.y, this.vectorC.labelDist);

        shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    background: ${colors.background};
                }
                .grid-line {
                    stroke: ${colors.grid};
                    stroke-width: 0.1;
                    stroke-dasharray: 0.1 0.1;
                }
                .axis {
                    stroke: ${colors.axis};
                    stroke-width: 0.1;
                }
                .vector { stroke-width: 0.15; }
                .vector-a { stroke: ${colors.vectorA}; }
                .vector-b { stroke: ${colors.vectorB}; }
                .vector-c { stroke: ${colors.vectorC}; }
                .handle {
                    fill: transparent;
                    stroke: none;
                    cursor: grab;
                    touch-action: none;
                }
                .handle.no-grab { cursor: auto; }
                .label {
                    font-family: "Geist", sans-serif;
                    font-weight: 500;
                    font-size: 0.04rem;
                    user-select: none;
                }
                .label-a { fill: ${colors.vectorA}; }
                .label-b { fill: ${colors.vectorB}; }
                .label-c { fill: ${colors.vectorC}; }
            </style>
            <svg viewBox="${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}">
                <g transform="scale(1,-1)">
                    <defs>
                        <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
                            <path d="M 1 0 L 0 0 0 1" fill="none" class="grid-line" />
                        </pattern>
                        <marker id="arrowhead-a-${isDark ? 'dark' : 'light'}" markerWidth="6" markerHeight="4" orient="auto"
                        refX="4" refY="2" fill="${colors.vectorA}">
                            <polygon points = "0 0, 6 2, 0 4"></polygon>
                        </marker>
                        <marker id="arrowhead-b-${isDark ? 'dark' : 'light'}" markerWidth="6" markerHeight="4" orient="auto"
                            refX="4" refY="2" fill="${colors.vectorB}">
                            <polygon points = "0 0, 6 2, 0 4"></polygon>
                        </marker>
                        <marker id="arrowhead-c-${isDark ? 'dark' : 'light'}" markerWidth="6" markerHeight="4" orient="auto"
                            refX="4" refY="2" fill="${colors.vectorC}">
                            <polygon points = "0 0, 6 2, 0 4"></polygon>
                        </marker>
                        <marker id="arrowhead-axis" markerWidth="6" markerHeight="4" orient="auto"
                            refX="4" refY="2" fill="${colors.axis}">
                            <polygon points = "0 0, 6 2, 0 4"></polygon>
                        </marker>
                    </defs>
                    <!-- Grid -->
                    <rect x="${this.bounds.x}" y="${this.bounds.y}" width="${this.bounds.width}" height="${this.bounds.height}" fill="url(#grid)" />

                    <!-- Axes -->
                    <line x1="${this.bounds.x}" y1="0" x2="${-this.bounds.x}" y2="0" class="axis" marker-end="url(#arrowhead-axis)" />
                    <line x1="0" y1="${this.bounds.y}" x2="0" y2="${-this.bounds.y}" class="axis" marker-end="url(#arrowhead-axis)" />

                    <!-- Vector A -->
                    <line id="${this.vectorA.vectorId}" class="vector vector-a" x1="0" y1="0" x2="${this.vectorA.pos.x}" y2="${this.vectorA.pos.y}" marker-end="url(#arrowhead-a-${isDark ? 'dark' : 'light'})" />
                    <circle id="${this.vectorA.handleId}" class="handle" cx="${this.vectorA.pos.x}" cy="${this.vectorA.pos.y}" r="0.8" />
                    <text id="${this.vectorA.labelId}" class="label label-a" transform="scale(1, -1)" text-anchor="middle" dominant-baseline="middle"
                        x="${vectorALabelPos.x}" y="${vectorALabelPos.y}">A</text>

                    <!-- Vector B -->
                    <line id="${this.vectorB.vectorId}" class="vector vector-b" x1="0" y1="0" x2="${this.vectorB.pos.x}" y2="${this.vectorB.pos.y}" marker-end="url(#arrowhead-b-${isDark ? 'dark' : 'light'})" />
                    <circle id="${this.vectorB.handleId}" class="handle" cx="${this.vectorB.pos.x}" cy="${this.vectorB.pos.y}" r="0.8" />
                    <text id="${this.vectorB.labelId}" class="label label-b" transform="scale(1, -1)" text-anchor="middle" dominant-baseline="middle"
                        x="${vectorBLabelPos.x}" y="${vectorBLabelPos.y}">B</text>

                    <!-- Vector C -->
                    <line id="${this.vectorC.vectorId}" class="vector vector-c" x1="0" y1="0" x2="${this.vectorC.pos.x}" y2="${this.vectorC.pos.y}" marker-end="url(#arrowhead-c-${isDark ? 'dark' : 'light'})" />
                    <circle id="${this.vectorC.handleId}" class="handle no-grab" cx="${this.vectorC.pos.x}" cy="${this.vectorC.pos.y}" r="0.8" />
                    <text id="${this.vectorC.labelId}" class="label label-c" transform="scale(1, -1)" text-anchor="middle" dominant-baseline="middle"
                        x="${vectorCLabelPos.x}" y="${vectorCLabelPos.y}">A + B</text>
                </g>
            </svg>
        `;
    }

    updateVectorSum() {
        this.vectorC.pos.x = this.vectorA.pos.x + this.vectorB.pos.x;
        this.vectorC.pos.y = this.vectorA.pos.y + this.vectorB.pos.y;
    }

    updateVectorDisplay(vectorConfig) {
        const shadow = this.shadowRoot;
        const handle = shadow.getElementById(vectorConfig.handleId);
        const vector = shadow.getElementById(vectorConfig.vectorId);
        const label = shadow.getElementById(vectorConfig.labelId);

        if (!handle || !vector || !label) return;

        // Update handle position
        handle.setAttribute('cx', vectorConfig.pos.x);
        handle.setAttribute('cy', vectorConfig.pos.y);

        // Update vector position
        vector.setAttribute('x2', vectorConfig.pos.x);
        vector.setAttribute('y2', vectorConfig.pos.y);

        // Recalculate and update label position
        const newLabelPos = this.calculateLabelPosition(0, 0, vectorConfig.pos.x, vectorConfig.pos.y, vectorConfig.labelDist);
        label.setAttribute("x", newLabelPos.x);
        label.setAttribute("y", newLabelPos.y);
    }

    onVectorUpdate(vectorKey, newPosition) {
        // Update the vector's position
        const vector = vectorKey === "vectorA" ? this.vectorA : this.vectorB;
        vector.pos.x = newPosition.x;
        vector.pos.y = newPosition.y;

        // Recalc sum
        this.updateVectorSum();

        // Update display
        this.updateVectorDisplay(vector);
        // Update sum's display, as well
        this.updateVectorDisplay(this.vectorC);
    }

    setupInteraction() {
        const shadow = this.shadowRoot;
        const svg = shadow.querySelector("svg");

        let currentDrag = null;

        // Convert screen coordinates to SVG coordinates
        function screenToSVG(screenX, screenY) {
            const svgPoint = svg.createSVGPoint();
            svgPoint.x = screenX;
            svgPoint.y = screenY;
            const transformedPoint = svgPoint.matrixTransform(svg.getScreenCTM().inverse());
            return {
                x: transformedPoint.x,
                y: -transformedPoint.y
            };
        }

        [this.vectorA, this.vectorB].forEach(handleConfig => {
            const handle = shadow.getElementById(handleConfig.handleId);

            if (!handle) return;

            handle.addEventListener("pointerdown", (e) => {
                e.preventDefault();
                svg.setPointerCapture(e.pointerId);

                const currentVector = handleConfig.pos;

                // Get mouse position in SVG coordinates
                const rect = svg.getBoundingClientRect();
                const svgCoords = screenToSVG(e.clientX - rect.left, e.clientY - rect.top);

                // Calculate offset between mouse and circle center
                const dragOffset = {
                    x: svgCoords.x - currentVector.x,
                    y: svgCoords.y - currentVector.y
                };

                currentDrag = {
                    handleConfig,
                    dragOffset
                };

                handle.style.cursor = "grabbing";
            });
        });

        document.addEventListener("pointermove", (e) => {
            if (!currentDrag) return;

            e.preventDefault();

            const rect = svg.getBoundingClientRect();
            const svgCoords = screenToSVG(e.clientX - rect.left, e.clientY - rect.top);

            // Calculate new circle position (subtract the offset)
            const newX = svgCoords.x - currentDrag.dragOffset.x;
            const newY = svgCoords.y - currentDrag.dragOffset.y;

            const constrainedX = Math.max(this.bounds.x, Math.min(-this.bounds.x, newX));
            const constrainedY = Math.max(this.bounds.y, Math.min(-this.bounds.y, newY));

            // Update
            this.onVectorUpdate(currentDrag.handleConfig.key, {
                x: constrainedX,
                y: constrainedY
            });
        });

        document.addEventListener("pointerup", () => {
            if (currentDrag) {
                svg.releasePointerCapture(e.pointerId);

                const handle = shadow.getElementById(currentDrag.handleConfig.handleId);
                if (handle) handle.style.cursor = "grab";

                currentDrag = null;
            }
        });
    }
}

customElements.define("vector-add", VectorAdd);

export { VectorAdd };
