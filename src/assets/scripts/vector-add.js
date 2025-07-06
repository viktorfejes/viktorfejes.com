function createSVGElement(tag, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }
    return element;
}

function calculateLabelPosition(x1, y1, x2, y2, offsetDistance) {
    // Calculate midpoint of the line
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    // Calculate the angle of the line in rads
    const angleRad = Math.atan2(y2 - y1, x2 - x1);

    // Calculate the offset in X and Y dirs to move the text perpendicula to the line
    const offsetX = offsetDistance * Math.cos(angleRad - Math.PI / 2);
    const offsetY = offsetDistance * Math.sin(angleRad - Math.PI / 2);

    return {x: midX + offsetX, y: midY + offsetY};
}

function calculateVectorLineLength(vectorStart, vectorEnd, arrowWidth, arrowRefX, strokeWidth) {
    const arrowLength = (arrowWidth - arrowRefX) * strokeWidth;

    const dx = vectorEnd.x - vectorStart.x;
    const dy = vectorEnd.y - vectorStart.y;
    const len = Math.hypot(dx, dy);

    const ux = dx / len;
    const uy = dy / len;

    return {
        x: vectorEnd.x - arrowLength * ux,
        y: vectorEnd.y - arrowLength * uy,
    };
}

class Point {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;

        this.listeners = new Set();
    }

    set(x, y) {
        this.x = x;
        this.y = y;

        this.notify();
    }

    notify() {
        for (const listener of this.listeners) {
            listener();
        }
    }

    onChange(fn) {
        this.listeners.add(fn);
    }
}

class Vector {
    constructor({start, end, label = "", parent, key}) {
        this.start = start;
        this.end = end;
        this.label = label;
        this.parent = parent;
        this.key = key;

        // Group
        this.group = createSVGElement("g");

        // Line
        this.line = createSVGElement("line");
        this.line.classList.add("vector-line", `vector-line--${this.key}`);

        // Label
        if (label) {
            this.labelEl = createSVGElement("text", {
                "text-anchor": "middle",
                "dominant-baseline": "middle",
                transform: "scale(1,-1)"
            });
            this.labelEl.textContent = label;
            this.labelEl.classList.add("vector-label", `vector-label--${this.key}`);
        }

        // Append everything appropriately.
        this.group.appendChild(this.line);
        if (label) this.group.appendChild(this.labelEl);
        this.parent.appendChild(this.group);

        // Add listeners to points so they can call this update
        this.start.onChange(() => this.update());
        this.end.onChange(() => this.update());

        this.update();
    }

    update() {
        const {x: sx, y: sy} = this.start;
        const {x: ex, y: ey} = this.end;

        const {x: lineX, y: lineY} = calculateVectorLineLength(this.start, this.end, 3, 2.1, 0.2);
        this.line.setAttribute("x1", sx);
        this.line.setAttribute("y1", sy);
        this.line.setAttribute("x2", lineX);
        this.line.setAttribute("y2", lineY);

        if (this.labelEl) {
            const {x: labelX, y: labelY} = calculateLabelPosition(sx, sy, ex, ey, 0.5);
            this.labelEl.setAttribute("x", labelX);
            this.labelEl.setAttribute("y", -labelY);
        }
    }

    getStartPoint() {
        return this.start;
    }

    getEndPoint() {
        return this.end;
    }
}

class Handle {
    constructor({ point, radius = 0.3, interactive = false, parent }) {
        this.point = point;
        this.radius = radius;
        this.interactive = interactive;
        this.parent = parent;

        this.dragging = false;

        this.el = createSVGElement("circle", {
            cx: this.point.x,
            cy: this.point.y,
            r: this.radius,
            fill: "transparent"
        });

        this.parent.appendChild(this.el);

        // Sync handle position when point moves independently
        this.point.onChange(() => {
            this.el.setAttribute("cx", this.point.x);
            this.el.setAttribute("cy", this.point.y);
        })

        if (interactive) {
            this.el.addEventListener("pointerdown", (e) => {
                this.dragging = true;

                // Moving
                this.parent.addEventListener("pointermove", this.onPointerMove);

                // End of moving
                document.addEventListener("pointerup", () => {
                    this.dragging = false;
                    document.removeEventListener("pointermove", this.onPointerMove);
                }, { once: true });
            });
        }
    }

    onPointerMove = (e) => {
        if (!this.dragging) return;
        const svgCoords = this.screenToSVG(e.clientX, e.clientY);

        this.point.set(svgCoords.x, svgCoords.y);
    }

    screenToSVG(screenX, screenY) {
       const svgPoint = this.parent.createSVGPoint();
       svgPoint.x = screenX;
       svgPoint.y = screenY;
       const transformedPoint = svgPoint.matrixTransform(this.parent.getScreenCTM().inverse());
       return {
           x: transformedPoint.x,
           y: transformedPoint.y
       };
    }
}

class VectorAdd extends HTMLElement {
    constructor() {
        super();

        this.bounds = {
            x: -2,
            y: -2,
            width: 20,
            height: 16
        };

        // Create shadow DOM
        this.attachShadow({mode: "open"});
    }

    connectedCallback() {
        this.render();
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
            vectorSum: isDark ? "#fb7185" : "#a3e635",
            vectorAux: isDark ? "#d4d4d4": "#e5e5e5",
        };

        // Style
        const style = document.createElement("style");
        style.textContent = `
            :host {
                display: block;
                background: ${colors.background};
            }
            .grid-line {
                stroke: ${colors.grid};
                stroke-width: 0.1;
                stroke-dasharray: 0.1 0.1;
            }
            .axis-line {
                stroke: ${colors.axis};
                stroke-width: 0.1;
            }
            .vector-line { stroke-width: 0.2; }
            .vector-line--vectorA { 
                marker-end: url(#arrowhead-a);
                stroke: ${colors.vectorA};
            }
            .vector-line--vectorB {
                marker-end: url(#arrowhead-b);
                stroke: ${colors.vectorB};
            }
            .vector-line--vectorSum {
                marker-end: url(#arrowhead-sum);
                stroke: ${colors.vectorSum};
            }
            .vector-line--vectorGhostAB,
            .vector-line--vectorGhostBA {
                marker-end: url(#arrowhead-aux);
                stroke: ${colors.vectorAux};
                stroke-dasharray: 0.3 0.1;
            }
            .vector-label {
                user-select: none;
                pointer-events: none;
                font-family: "Geist Mono", sans-serif;
                font-size: 0.05rem;
                font-weight: 500;
            }
            .vector-label--vectorA { fill: ${colors.vectorA}; }
            .vector-label--vectorB { fill: ${colors.vectorB}; }
            .vector-label--vectorSum { fill: ${colors.vectorSum}; }
            #arrowhead-a { fill: ${colors.vectorA}; }
            #arrowhead-b { fill: ${colors.vectorB}; }
            #arrowhead-sum { fill: ${colors.vectorSum}; }
            #arrowhead-aux { fill: ${colors.vectorAux}; }
        `;
        shadow.appendChild(style);

        // Create SVG canvas
        const svg = createSVGElement("svg", {
            "viewBox": `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`,
            transform: "scale(1,-1)"
        });

        // Create definitions for the SVG
        {
            const defs = createSVGElement("defs");

            // Create pattern element
            const pattern = createSVGElement("pattern", {
                "id": "grid",
                "width": 1,
                "height": 1,
                "patternUnits": "userSpaceOnUse"
            });

            const patternPath = createSVGElement("path", {
                "d": "M 1 0 L 0 0 0 1",
                "fill": "none",
            });
            patternPath.classList.add("grid-line");
            pattern.appendChild(patternPath);
            defs.appendChild(pattern);

            // Create arrow(s)
            const marker = createSVGElement("marker", {
                "id": "arrowhead-a",
                "markerWidth": 3,
                "markerHeight": 3,
                "orient": "auto",
                "refX": 2.1,
                "refY": 1.5
            });

            const markerPoly = createSVGElement("polygon", {
                "points": "0 0, 3 1.5, 0 3"
            });
            marker.appendChild(markerPoly);
            defs.appendChild(marker);

            const arrowB = createSVGElement("marker", {
                "id": "arrowhead-b",
                "markerWidth": 3,
                "markerHeight": 3,
                "orient": "auto",
                "refX": 2.1,
                "refY": 1.5
            });
            arrowB.appendChild(markerPoly.cloneNode(true));
            defs.appendChild(arrowB);

            const arrowSum = createSVGElement("marker", {
                "id": "arrowhead-sum",
                "markerWidth": 3,
                "markerHeight": 3,
                "orient": "auto",
                "refX": 2.1,
                "refY": 1.5
            });
            arrowSum.appendChild(markerPoly.cloneNode(true));
            defs.appendChild(arrowSum);

            const arrowAux = createSVGElement("marker", {
                "id": "arrowhead-aux",
                "markerWidth": 3,
                "markerHeight": 3,
                "orient": "auto",
                "refX": 2.1,
                "refY": 1.5
            });
            arrowAux.appendChild(markerPoly.cloneNode(true));
            defs.appendChild(arrowAux);

            svg.appendChild(defs);
        }

        // Create background and axes
        {
            // Background
            const rect = createSVGElement("rect", {
                "x": this.bounds.x,
                "y": this.bounds.y,
                "width": this.bounds.width,
                "height": this.bounds.height,
                "fill": "url(#grid)"
            });
            svg.appendChild(rect);

            // X-axis
            const axisX = createSVGElement("line", {
                "x1": 0,
                "y1": this.bounds.y,
                "x2": 0,
                "y2": this.bounds.height
            });
            // Y-axis
            const axisY = createSVGElement("line", {
                "x1": this.bounds.x,
                "y1": 0,
                "x2": this.bounds.width,
                "y2": 0
            });

            axisX.classList.add("axis-line");
            axisY.classList.add("axis-line");

            svg.appendChild(axisX);
            svg.appendChild(axisY);
        }

        // Create points for vectors (unconventionally: tail and head)
        const vectorA = new Vector({
            start: new Point("va_s", 0, 0),
            end: new Point("va_e", 9, 3),
            label: "A",
            parent: svg,
            key: "vectorA"});

        const vectorB = new Vector({
            start: new Point("vb_s", 0, 0),
            end: new Point("vb_e", 3, 6),
            label: "B",
            parent: svg,
            key: "vectorB"});

        const vectorSum = new Vector({
            start: new Point("vsum_s", 0, 0),
            end: new Point("vsum_e", 12, 9),
            label: "A+B",
            parent: svg,
            key: "vectorSum"});

        const vectorGhostAB = new Vector({
            start: vectorA.getEndPoint(),
            end: vectorSum.getEndPoint(),
            parent: svg,
            key: "vectorGhostAB"});
        const vectorGhostBA = new Vector({
            start: vectorB.getEndPoint(),
            end: vectorSum.getEndPoint(),
            parent: svg,
            key: "vectorGhostBA"});

        function addVectors(target, a, b) {
            return function update() {
                target.set(a.x + b.x, a.y + b.y);
            };
        }
        vectorA.getEndPoint().onChange(addVectors(vectorSum.getEndPoint(), vectorA.getEndPoint(), vectorB.getEndPoint()));
        vectorB.getEndPoint().onChange(addVectors(vectorSum.getEndPoint(), vectorA.getEndPoint(), vectorB.getEndPoint()));

        // Add handles
        const handleA = new Handle({
            point: vectorA.getEndPoint(),
            radius: 0.8,
            interactive: true,
            parent: svg
        });
        const handleB = new Handle({
            point: vectorB.getEndPoint(),
            radius: 0.8,
            interactive: true,
            parent: svg
        });

        // Append svg to shadow DOM
        shadow.appendChild(svg);
    }
}

customElements.define("vector-add", VectorAdd);

export { VectorAdd };
