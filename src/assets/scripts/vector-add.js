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
    constructor({start, end, label = "", svgRoot, key}) {
        this.start = start;
        this.end = end;
        this.label = label;
        this.svgRoot = svgRoot;
        this.key = key;

        // Group
        this.group = createSVGElement("g");

        // Line
        this.line = createSVGElement("line");
        this.line.classList.add("vector-line");

        // Label
        if (label) {
            this.labelEl = createSVGElement("text", {
                "text-anchor": "middle",
                "dominant-baseline": "middle"
            });
            this.labelEl.textContent = label;
            this.labelEl.classList.add("vector-label");
        }

        // Append everything appropriately.
        this.group.appendChild(this.line);
        if (label) this.group.appendChild(this.labelEl);
        this.svgRoot.appendChild(this.group);

        // Add listeners to points so they can call this update
        this.start.onChange(() => this.update());
        this.end.onChange(() => this.update());

        this.update();
    }

    update() {
        const {x: sx, y: sy} = this.start;
        const {x: ex, y: ey} = this.end;

        const {x: lineX, y: lineY} = calculateVectorLineLength(this.start, this.end, 6, 0.1, 0.2);
        this.line.setAttribute("x1", sx);
        this.line.setAttribute("y1", sy);
        this.line.setAttribute("x2", lineX);
        this.line.setAttribute("y2", lineY);

        if (this.labelEl) {
            const {x: labelX, y: labelY} = calculateLabelPosition(sx, sy, ex, ey, 0.5);
            this.labelEl.setAttribute("x", labelX);
            this.labelEl.setAttribute("y", labelY);
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
    constructor({ point, radius = 0.3, interactive = false, svgRoot }) {
        this.point = point;
        this.radius = radius;
        this.interactive = interactive;
        this.svgRoot = svgRoot;

        this.dragging = false;

        this.el = createSVGElement("circle", {
            cx: this.point.x,
            cy: this.point.y,
            r: this.radius,
            fill: "transparent"
        });

        this.svgRoot.appendChild(this.el);

        // Sync handle position when point moves independently
        this.point.onChange(() => {
            this.el.setAttribute("cx", this.point.x);
            this.el.setAttribute("cy", this.point.y);
        })

        if (interactive) {
            this.el.addEventListener("pointerdown", (e) => {
                this.dragging = true;

                // Moving
                document.addEventListener("pointermove", this.onPointerMove);

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
       const svgPoint = this.svgRoot.createSVGPoint();
       svgPoint.x = screenX;
       svgPoint.y = screenY;
       const transformedPoint = svgPoint.matrixTransform(this.svgRoot.getScreenCTM().inverse());
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
            x: -10,
            y: -8,
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

        // Style
        const style = document.createElement("style");
        style.textContent = `
            :host {
                display: block;
                background: #ccc;
            }
            .grid-line {
                stroke: #ddd;
                stroke-width: 0.1;
            }
            .axis-line {
                stroke: #333;
                stroke-width: 0.1;
            }
            .vector-line {
                stroke: #251a8f;
                stroke-width: 0.2;
                marker-end: url(#arrowhead-a);
            }
            .vector-label {
                user-select: none;
                pointer-events: none;
                font-family: "Geist", sans-serif;
                font-size: 0.08rem;
                font-weight: 500;
            }
            #arrowhead-a {
                fill: #251a8f;
            }
        `;
        shadow.appendChild(style);

        // Create SVG canvas
        const svg = createSVGElement("svg", {
            "viewBox": `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`
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
                "markerWidth": 6,
                "markerHeight": 4,
                "orient": "auto",
                "refX": 0.1,
                "refY": 2
            });

            const markerPoly = createSVGElement("polygon", {
                "points": "0 0, 6 2, 0 4"
            });
            marker.appendChild(markerPoly);
            defs.appendChild(marker);

            svg.appendChild(defs);
        }

        // Create background and axes
        {
            // Background
            const rect = createSVGElement("rect", {
                "x": -10,
                "y": -8,
                "width": 20,
                "height": 16,
                "fill": "url(#grid)"
            });
            svg.appendChild(rect);

            // X-axis
            const axisX = createSVGElement("line", {
                "x1": 0,
                "y1": -8,
                "x2": 0,
                "y2": 8
            });
            // Y-axis
            const axisY = createSVGElement("line", {
                "x1": -10,
                "y1": 0,
                "x2": 10,
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
            end: new Point("va_e", 3, 4),
            label: "A",
            svgRoot: svg,
            key: "vectorA"});

        const vectorB = new Vector({
            start: new Point("vb_s", 0, 0),
            end: new Point("vb_e", -2, 5),
            label: "B",
            svgRoot: svg,
            key: "vectorB"});

        const vectorSum = new Vector({
            start: new Point("vsum_s", 0, 0),
            end: new Point("vsum_e", 1, 9),
            label: "A + B",
            svgRoot: svg,
            key: "vectorSum"});

        const vectorGhostAB = new Vector({
            start: vectorA.getEndPoint(),
            end: vectorSum.getEndPoint(),
            svgRoot: svg,
            key: "vectorGhostAB"});
        const vectorGhostBA = new Vector({
            start: vectorB.getEndPoint(),
            end: vectorSum.getEndPoint(),
            svgRoot: svg,
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
            svgRoot: svg
        });
        const handleB = new Handle({
            point: vectorB.getEndPoint(),
            radius: 0.8,
            interactive: true,
            svgRoot: svg
        });

        // Append svg to shadow DOM
        shadow.appendChild(svg);
    }

    createVector({key, start, end, label = ""}) {
        const g = createSVGElement("g");
        g.classList.add("vector");
        g.dataset.key = key;
        g.dataset.start = `${start.x},${start.y}`;
        g.dataset.end = `${end.x},${end.y}`;

        // Calculate the size of the line (vector - arrowhead)
        const {x: lx, y: ly} = calculateVectorLineLength(start, end, 6, 0.1, 0.2);

        const line = createSVGElement("line", {
            "x1": start.x,
            "y1": start.y,
            "x2": lx,
            "y2": ly,
        });
        line.classList.add("vector-line");

        if (label) {
            // Calculate label position
            const {x: labelX, y: labelY} = calculateLabelPosition(start.x, start.y, end.x, end.y, 0.5);

            const text = createSVGElement("text", {
                "x": labelX,
                "y": labelY
            });
            text.textContent = label;
            text.classList.add("vector-label");

            g.appendChild(text);
        }

        g.appendChild(line);

        return g;
    }
}

customElements.define("vector-add", VectorAdd);

export { VectorAdd };
