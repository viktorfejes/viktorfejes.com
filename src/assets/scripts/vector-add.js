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
    constructor({
        start,
        end,
        label = {},
        stroke = {},
        parent,
        key,
        marker = ""
    }) {

        // Defaults for objects
        this.label = {
            text: "",
            offset: 0.5,
            ...label
        };
        this.stroke = {
            width: 0.15,
            color: "black",
            ...stroke
        };

        this.start = start;
        this.end = end;
        this.parent = parent;
        this.key = key;
        this.marker = marker;

        // Group
        this.group = createSVGElement("g");

        // Line
        this.line = createSVGElement("line", {
            "stroke-width": this.stroke.width,
            "stroke": this.stroke.color
        });
        this.line.classList.add("vector-line", `vector-line--${this.key}`);

        // Marker
        if (marker) {
            this.marker.setAttribute("fill", this.stroke.color);
            this.line.setAttribute("marker-end", `url(#${this.marker.id})`);
        }

        // Append line to the group
        this.group.appendChild(this.line);

        // Label
        if (label) {
            this.labelEl = createSVGElement("text", {
                fill: this.stroke.color,
                "text-anchor": "middle",
                "dominant-baseline": "middle",
                transform: "scale(1 -1)"
            });
            this.labelEl.textContent = label.text;
            this.labelEl.classList.add("vector-label", `vector-label--${this.key}`);

            this.group.appendChild(this.labelEl);
        }

        // Append to parent
        this.parent.appendChild(this.group);

        // Add listeners to points so they can call this update
        this.start.onChange(() => this.update());
        this.end.onChange(() => this.update());

        this.update();
    }

    update() {
        const {x: sx, y: sy} = this.start;
        let {x: ex, y: ey} = this.end;

        if (this.marker) {
            const {x: lineX, y: lineY} = calculateVectorLineLength(
                this.start, this.end,
                parseFloat(this.marker.getAttribute("markerWidth")),
                parseFloat(this.marker.getAttribute("refX")),
                this.stroke.width
            );
            ex = lineX;
            ey = lineY;
        }
        this.line.setAttribute("x1", sx);
        this.line.setAttribute("y1", sy);
        this.line.setAttribute("x2", ex);
        this.line.setAttribute("y2", ey);

        if (this.labelEl) {
            const {x: labelX, y: labelY} = calculateLabelPosition(sx, sy, ex, ey, this.label.offset);
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

    getStr() {
        return `${this.end.x.toFixed(1)}, ${this.end.y.toFixed(1)}`;
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
        this.el.classList.add("handle");

        this.parent.appendChild(this.el);

        // Sync handle position when point moves independently
        this.point.onChange(() => {
            this.el.setAttribute("cx", this.point.x);
            this.el.setAttribute("cy", this.point.y);
        })

        if (interactive) {
            this.el.style.cursor = "grab";

            this.el.addEventListener("pointerdown", (e) => {
                this.dragging = true;
                this.el.style.cursor = "grabbing";

                // Moving
                this.parent.addEventListener("pointermove", this.onPointerMove);

                // End of moving
                document.addEventListener("pointerup", () => {
                    this.dragging = false;
                    this.el.style.cursor = "grab";
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
        const svg = this.parent.closest("svg");
        const svgPoint = svg.createSVGPoint();
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

        document.addEventListener("theme-changed", () => {
            this.render();
        })
    }

    render() {
        const shadow = this.shadowRoot;
        const isDark = document.querySelector("html").classList.contains("dark");

        const colors = {
            background: isDark ? "#171717" : "#fafafa",
            grid: isDark ? "#262626" : "#f5f5f5",
            axis: isDark ? "#525252" : "#0a0a0a",
            vectorA: isDark ? "#f43f5e" : "#f43f5e",
            vectorB: isDark ? "#65a30d" : "#65a30d",
            vectorSum: isDark ? "#0284c7" : "#0284c7",
            vectorAux: isDark ? "#262626": "#e5e5e5",
        };

        const vectorStrokeWidth = 0.15;

        // Empty the shadowDom
        shadow.innerHTML = "";

        // Style
        const style = document.createElement("style");
        style.textContent = `
            :host {
                display: block;
            }
            svg {
                touch-action: none;
            }
            .wrapper {
                background: ${colors.background};
                padding: 2rem 2rem 0 2rem;
            }
            .grid-line {
                stroke: ${colors.grid};
                stroke-width: 0.05;
            }
            .axis-line {
                stroke: ${colors.axis};
                stroke-width: 0.05;
            }
            .vector-line--vectorGhostAB,
            .vector-line--vectorGhostBA {
                stroke-dasharray: 0.3 0.1;
            }
            .vector-label {
                user-select: none;
                pointer-events: none;
                font-family: "Geist Mono", monospace;
                font-size: 0.04rem;
                font-weight: 500;
            }
            .info-panel {
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                flex-wrap: wrap;
                gap: 1rem;
                padding: 1rem 0;
            }
            .vector-info {
                background: ${colors.grid};
                padding: 0.4rem 0;
                border-radius: 0.3rem;
                white-space: nowrap;
                width: 8rem;
                text-align: center;
            }
            .vector-info.a {
                color: ${colors.vectorA};
                background: #fecdd3;
            }
            .vector-info.b {
                color: ${colors.vectorB};
                background: #ecfccb;
            }
            .vector-info.sum {
                color: ${colors.vectorSum};
                background: #e0f2fe;
            }
        `;
        shadow.appendChild(style);

        // Create wrapping div
        const div = document.createElement("div");
        div.classList.add("wrapper");
        shadow.appendChild(div);

        // Create SVG canvas
        const svg = createSVGElement("svg", {
            "viewBox": `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`,
        });

        // Create definitions for the SVG
        const defs = createSVGElement("defs");

        // Create arrow(s)
        const arrowA = createSVGElement("marker", {
            "id": "arrowhead-a",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });

        const markerPoly = createSVGElement("polygon", {
            "points": "0 0, 4 2, 0 4"
        });
        arrowA.appendChild(markerPoly);
        defs.appendChild(arrowA);

        const arrowB = createSVGElement("marker", {
            "id": "arrowhead-b",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });
        arrowB.appendChild(markerPoly.cloneNode(true));
        defs.appendChild(arrowB);

        const arrowSum = createSVGElement("marker", {
            "id": "arrowhead-sum",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });
        arrowSum.appendChild(markerPoly.cloneNode(true));
        defs.appendChild(arrowSum);

        const arrowAux = createSVGElement("marker", {
            "id": "arrowhead-aux",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });
        arrowAux.appendChild(markerPoly.cloneNode(true));
        defs.appendChild(arrowAux);

        svg.appendChild(defs);

        // Background
        // Horizontal grid lines
        for (let i = this.bounds.y + 1; i < (this.bounds.y + this.bounds.height); ++i) {
            const line = createSVGElement("line", {
                x1: this.bounds.x,
                y1: i,
                x2: this.bounds.x + this.bounds.width,
                y2: i
            });
            line.classList.add("grid-line");
            svg.appendChild(line);
        }
        
        // Vertical grid lines
        for (let i = this.bounds.x + 1; i < (this.bounds.x + this.bounds.width); ++i) {
            const line = createSVGElement("line", {
                x1: i,
                y1: this.bounds.y,
                x2: i,
                y2: this.bounds.y + this.bounds.height,
            });
            line.classList.add("grid-line");
            svg.appendChild(line);
        }

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

        const g_flip = createSVGElement("g", {
            transform: "scale(1 -1)"
        });
        svg.appendChild(g_flip);

        // Create points for vectors (unconventionally: tail and head)
        const p00 = new Point("p00", 0, 0);

        const vectorA = new Vector({
            start: new Point("va_s", 0, 0),
            end: new Point("va_e", 9, 3),
            label: {
                text: "A",
            },
            parent: g_flip,
            key: "vectorA",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorA
            },
            marker: arrowA
        });

        const vectorB = new Vector({
            start: new Point("vb_s", 0, 0),
            end: new Point("vb_e", -4, 4),
            label: {
                text: "B"
            },
            parent: g_flip,
            key: "vectorB",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorB
            },
            marker: arrowB
        });

        const pSum = new Point("psum", 5, 7);

        const vectorGhostAB = new Vector({
            start: vectorA.getEndPoint(),
            end: pSum,
            parent: g_flip,
            key: "vectorGhostAB",
            label: {
                text: "B"
            },
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorAux
            },
            marker: arrowAux
        });

        const vectorGhostBA = new Vector({
            start: vectorB.getEndPoint(),
            end: pSum,
            parent: g_flip,
            key: "vectorGhostBA",
            label: {
                text: "A"
            },
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorAux
            },
            marker: arrowAux
        });

        const vectorSum = new Vector({
            start: p00,
            end: pSum,
            label: {
                text: "A+B",
                offset: 0.8
            },
            parent: g_flip,
            key: "vectorSum",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorSum
            },
            marker: arrowSum
        });

        // Add handles
        const handleA = new Handle({
            point: vectorA.getEndPoint(),
            radius: 1.2,
            interactive: true,
            parent: g_flip
        });
        const handleB = new Handle({
            point: vectorB.getEndPoint(),
            radius: 1.2,
            interactive: true,
            parent: g_flip
        });

        // Append svg to shadow DOM
        div.appendChild(svg);

        // Create displays at the bottom
        const info = document.createElement("div");
        info.classList.add("info-panel");
        info.innerHTML = `
            <div class="vector-info a">A: <span id="info-a">(${vectorA.getStr()})</span></div>
            <div class="vector-info b">B: <span id="info-b">(${vectorB.getStr()})</span></div>
            <div class="vector-info sum">A+B: <span id="info-sum">(${vectorSum.getStr()})</span></div>
        `;

        div.appendChild(info);

        vectorA.getEndPoint().onChange(() => {
            const va = vectorA.getEndPoint();
            const vb = vectorB.getEndPoint();
            pSum.set(va.x + vb.x, va.y + vb.y);
            info.querySelector("#info-a").textContent = `(${va.x.toFixed(1)}, ${va.y.toFixed(1)})`;
            info.querySelector("#info-sum").textContent = `(${pSum.x.toFixed(1)}, ${pSum.y.toFixed(1)})`;
        });

        vectorB.getEndPoint().onChange(() => {
            const va = vectorA.getEndPoint();
            const vb = vectorB.getEndPoint();
            pSum.set(va.x + vb.x, va.y + vb.y);
            info.querySelector("#info-b").textContent = `(${vb.x.toFixed(1)}, ${vb.y.toFixed(1)})`;
            info.querySelector("#info-sum").textContent = `(${pSum.x.toFixed(1)}, ${pSum.y.toFixed(1)})`;
        });
    }
}

class VectorSub extends HTMLElement {
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

        document.addEventListener("theme-changed", () => {
            this.render();
        })
    }

    render() {
        const shadow = this.shadowRoot;
        const isDark = document.querySelector("html").classList.contains("dark");

        const colors = {
            background: isDark ? "#171717" : "#fafafa",
            grid: isDark ? "#262626" : "#f5f5f5",
            axis: isDark ? "#525252" : "#0a0a0a",
            vectorA: isDark ? "#f43f5e" : "#f43f5e",
            vectorB: isDark ? "#65a30d" : "#65a30d",
            vectorSum: isDark ? "#0284c7" : "#0284c7",
            vectorAux: isDark ? "#262626": "#e5e5e5",
        };

        const vectorStrokeWidth = 0.15;

        // Empty the shadowDom
        shadow.innerHTML = "";

        // Style
        const style = document.createElement("style");
        style.textContent = `
            :host {
                display: block;
            }
            svg {
                touch-action: none;
            }
            .wrapper {
                background: ${colors.background};
                padding: 2rem 2rem 0 2rem;
            }
            .grid-line {
                stroke: ${colors.grid};
                stroke-width: 0.05;
            }
            .axis-line {
                stroke: ${colors.axis};
                stroke-width: 0.05;
            }
            .vector-line--vectorGhostAB,
            .vector-line--vectorGhostBA {
                stroke-dasharray: 0.3 0.1;
            }
            .vector-label {
                user-select: none;
                pointer-events: none;
                font-family: "Geist Mono", monospace;
                font-size: 0.04rem;
                font-weight: 500;
            }
            .info-panel {
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                flex-wrap: wrap;
                gap: 1rem;
                padding: 1rem 0;
            }
            .vector-info {
                background: ${colors.grid};
                padding: 0.4rem 0;
                border-radius: 0.3rem;
                white-space: nowrap;
                width: 8rem;
                text-align: center;
            }
            .vector-info.a {
                color: ${colors.vectorA};
                background: #fecdd3;
            }
            .vector-info.b {
                color: ${colors.vectorB};
                background: #ecfccb;
            }
            .vector-info.sum {
                color: ${colors.vectorSum};
                background: #e0f2fe;
            }
        `;
        shadow.appendChild(style);

        // Create wrapping div
        const div = document.createElement("div");
        div.classList.add("wrapper");
        shadow.appendChild(div);

        // Create SVG canvas
        const svg = createSVGElement("svg", {
            "viewBox": `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`,
        });

        // Create definitions for the SVG
        const defs = createSVGElement("defs");

        // Create arrow(s)
        const arrowA = createSVGElement("marker", {
            "id": "arrowhead-a",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });

        const markerPoly = createSVGElement("polygon", {
            "points": "0 0, 4 2, 0 4"
        });
        arrowA.appendChild(markerPoly);
        defs.appendChild(arrowA);

        const arrowB = createSVGElement("marker", {
            "id": "arrowhead-b",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });
        arrowB.appendChild(markerPoly.cloneNode(true));
        defs.appendChild(arrowB);

        const arrowSum = createSVGElement("marker", {
            "id": "arrowhead-sum",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });
        arrowSum.appendChild(markerPoly.cloneNode(true));
        defs.appendChild(arrowSum);

        const arrowAux = createSVGElement("marker", {
            "id": "arrowhead-aux",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });
        arrowAux.appendChild(markerPoly.cloneNode(true));
        defs.appendChild(arrowAux);

        svg.appendChild(defs);

        // Background
        // Horizontal grid lines
        for (let i = this.bounds.y + 1; i < (this.bounds.y + this.bounds.height); ++i) {
            const line = createSVGElement("line", {
                x1: this.bounds.x,
                y1: i,
                x2: this.bounds.x + this.bounds.width,
                y2: i
            });
            line.classList.add("grid-line");
            svg.appendChild(line);
        }
        
        // Vertical grid lines
        for (let i = this.bounds.x + 1; i < (this.bounds.x + this.bounds.width); ++i) {
            const line = createSVGElement("line", {
                x1: i,
                y1: this.bounds.y,
                x2: i,
                y2: this.bounds.y + this.bounds.height,
            });
            line.classList.add("grid-line");
            svg.appendChild(line);
        }

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

        const g_flip = createSVGElement("g", {
            transform: "scale(1 -1)"
        });
        svg.appendChild(g_flip);

        // Create points for vectors (unconventionally: tail and head)
        const p00 = new Point("p00", 0, 0);

        const vectorA = new Vector({
            start: new Point("va_s", 0, 0),
            end: new Point("va_e", 5, 3),
            label: {
                text: "A",
            },
            parent: g_flip,
            key: "vectorA",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorA
            },
            marker: arrowA
        });

        const vectorB = new Vector({
            start: new Point("vb_s", 0, 0),
            end: new Point("vb_e", -4, 4),
            label: {
                text: "B"
            },
            parent: g_flip,
            key: "vectorB",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorB
            },
            marker: arrowB
        });

        const pSum = new Point("psum", -9, 1);

        const vectorGhostAB = new Vector({
            start: vectorA.getEndPoint(),
            end: vectorB.getEndPoint(),
            parent: g_flip,
            key: "vectorGhostAB",
            label: {
                text: "B-A"
            },
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorAux
            },
            marker: arrowAux
        });

        const vectorSum = new Vector({
            start: p00,
            end: pSum,
            label: {
                text: "B-A",
                offset: 0.8
            },
            parent: g_flip,
            key: "vectorSum",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorSum
            },
            marker: arrowSum
        });

        // Add handles
        const handleA = new Handle({
            point: vectorA.getEndPoint(),
            radius: 1.2,
            interactive: true,
            parent: g_flip
        });
        const handleB = new Handle({
            point: vectorB.getEndPoint(),
            radius: 1.2,
            interactive: true,
            parent: g_flip
        });

        // Append svg to shadow DOM
        div.appendChild(svg);

        // Create displays at the bottom
        const info = document.createElement("div");
        info.classList.add("info-panel");
        info.innerHTML = `
            <div class="vector-info a">A: <span id="info-a">(${vectorA.getStr()})</span></div>
            <div class="vector-info b">B: <span id="info-b">(${vectorB.getStr()})</span></div>
            <div class="vector-info sum">B-A: <span id="info-sum">(${vectorSum.getStr()})</span></div>
        `;

        div.appendChild(info);

        vectorA.getEndPoint().onChange(() => {
            const va = vectorA.getEndPoint();
            const vb = vectorB.getEndPoint();
            pSum.set(vb.x - va.x, vb.y - va.y);
            info.querySelector("#info-a").textContent = `(${va.x.toFixed(1)}, ${va.y.toFixed(1)})`;
            info.querySelector("#info-sum").textContent = `(${pSum.x.toFixed(1)}, ${pSum.y.toFixed(1)})`;
        });

        vectorB.getEndPoint().onChange(() => {
            const va = vectorA.getEndPoint();
            const vb = vectorB.getEndPoint();
            pSum.set(vb.x - va.x, vb.y - va.y);
            info.querySelector("#info-b").textContent = `(${vb.x.toFixed(1)}, ${vb.y.toFixed(1)})`;
            info.querySelector("#info-sum").textContent = `(${pSum.x.toFixed(1)}, ${pSum.y.toFixed(1)})`;
        });
    }
}

class VectorScale extends HTMLElement {
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

        document.addEventListener("theme-changed", () => {
            this.render();
        })
    }

    render() {
        const shadow = this.shadowRoot;
        const isDark = document.querySelector("html").classList.contains("dark");

        const colors = {
            background: isDark ? "#171717" : "#fafafa",
            grid: isDark ? "#262626" : "#f5f5f5",
            axis: isDark ? "#525252" : "#0a0a0a",
            vectorA: isDark ? "#f43f5e" : "#f43f5e",
            vectorB: isDark ? "#65a30d" : "#65a30d",
        };

        const vectorStrokeWidth = 0.15;

        // Empty the shadowDom
        shadow.innerHTML = "";

        // Style
        const style = document.createElement("style");
        style.textContent = `
            :host {
                display: block;
            }
            svg {
                touch-action: none;
            }
            .wrapper {
                background: ${colors.background};
                padding: 2rem 2rem 0 2rem;
            }
            .grid-line {
                stroke: ${colors.grid};
                stroke-width: 0.05;
            }
            .axis-line {
                stroke: ${colors.axis};
                stroke-width: 0.05;
            }
            .vector-label {
                user-select: none;
                pointer-events: none;
                font-family: "Geist Mono", monospace;
                font-size: 0.04rem;
                font-weight: 500;
            }
            .control-panel {
                width: 100%;
                display: flex;
                place-content: center;
                padding: 1rem 0;
                gap: 1rem;
            }
            .control-panel span {
                width: 3rem;
                text-align: right;
            }
            .info-panel {
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                flex-wrap: wrap;
                gap: 0.75rem;
                padding: 1rem 0;
            }
            .vector-info {
                background: ${colors.grid};
                padding: 0.4rem 0;
                border-radius: 0.3rem;
                white-space: nowrap;
                width: 10rem;
                text-align: center;
            }
            .vector-info.a {
                color: ${colors.vectorA};
                background: #fecdd3;
            }
            .vector-info.scaled {
                color: ${colors.vectorB};
                background: #ecfccb;
            }
        `;
        shadow.appendChild(style);

        // Create wrapping div
        const div = document.createElement("div");
        div.classList.add("wrapper");
        shadow.appendChild(div);

        // Create SVG canvas
        const svg = createSVGElement("svg", {
            "viewBox": `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`,
        });

        // Create definitions for the SVG
        const defs = createSVGElement("defs");

        // Create arrow(s)
        const arrowA = createSVGElement("marker", {
            "id": "arrowhead-a",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });

        const markerPoly = createSVGElement("polygon", {
            "points": "0 0, 4 2, 0 4"
        });
        arrowA.appendChild(markerPoly);
        defs.appendChild(arrowA);

        const arrowB = createSVGElement("marker", {
            "id": "arrowhead-b",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });
        arrowB.appendChild(markerPoly.cloneNode(true));
        defs.appendChild(arrowB);

        svg.appendChild(defs);

        // Background
        // Horizontal grid lines
        for (let i = this.bounds.y + 1; i < (this.bounds.y + this.bounds.height); ++i) {
            const line = createSVGElement("line", {
                x1: this.bounds.x,
                y1: i,
                x2: this.bounds.x + this.bounds.width,
                y2: i
            });
            line.classList.add("grid-line");
            svg.appendChild(line);
        }
        
        // Vertical grid lines
        for (let i = this.bounds.x + 1; i < (this.bounds.x + this.bounds.width); ++i) {
            const line = createSVGElement("line", {
                x1: i,
                y1: this.bounds.y,
                x2: i,
                y2: this.bounds.y + this.bounds.height,
            });
            line.classList.add("grid-line");
            svg.appendChild(line);
        }

        // X-axis
        const axisX = createSVGElement("line", {
            "x1": 0,
            "y1": this.bounds.y,
            "x2": 0,
            "y2": this.bounds.y + this.bounds.height
        });
        // Y-axis
        const axisY = createSVGElement("line", {
            "x1": this.bounds.x,
            "y1": 0,
            "x2": this.bounds.x + this.bounds.width,
            "y2": 0
        });

        axisX.classList.add("axis-line");
        axisY.classList.add("axis-line");

        svg.appendChild(axisX);
        svg.appendChild(axisY);

        const g_flip = createSVGElement("g", {
            transform: "scale(1 -1)"
        });
        svg.appendChild(g_flip);

        // Create points for vectors (unconventionally: tail and head)
        const p00 = new Point("p00", 0, 0);

        const vectorScaled = new Vector({
            start: p00,
            end: new Point("vb_e", 4.5, 4.5),
            label: {
                text: "Scaled",
                offset: -1.2
            },
            parent: g_flip,
            key: "vectorScaled",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorB
            },
            marker: arrowB
        });

        const vectorA = new Vector({
            start: p00,
            end: new Point("va_e", 3, 3),
            label: {
                text: "Base",
                offset: 1
            },
            parent: g_flip,
            key: "vectorA",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorA
            },
            marker: arrowA
        });

        // Add handles
        const handleA = new Handle({
            point: vectorA.getEndPoint(),
            radius: 1.2,
            interactive: true,
            parent: g_flip
        });

        // Append svg to shadow DOM
        div.appendChild(svg);

        // Create control at the bottom
        const control = document.createElement("div");
        control.classList.add("control-panel");
        control.innerHTML = `
            <label>Scale: </label>
            <input type="range" id="scale-slider" min="-2.0" max="2.0" step="0.1" value="1.5">
            <span id="scale-value">1.5x</span>
        `;
        div.appendChild(control);

        // Create displays at the bottom
        const info = document.createElement("div");
        info.classList.add("info-panel");
        info.innerHTML = `
            <div class="vector-info a">Base: <span id="info-a">(${vectorA.getStr()})</span></div>
            <div class="vector-info scaled">Scaled: <span id="info-scaled">(${vectorScaled.getStr()})</span></div>
        `;
        div.appendChild(info);

        const slider = control.querySelector("#scale-slider");
        const sliderValue = control.querySelector("#scale-value");

        slider.addEventListener("input", (e) => {
            const va = vectorA.getEndPoint();
            const scale = parseFloat(e.target.value);
            const scaled = { x: va.x * scale, y: va.y * scale };

            vectorScaled.getEndPoint().set(scaled.x, scaled.y);
            sliderValue.textContent = `${scale.toFixed(1)}x`;
            
            info.querySelector("#info-a").textContent = `(${va.x.toFixed(1)}, ${va.y.toFixed(1)})`;
            info.querySelector("#info-scaled").textContent = `(${scaled.x.toFixed(1)}, ${scaled.y.toFixed(1)})`;
        });

        vectorA.getEndPoint().onChange(() => {
            const va = vectorA.getEndPoint();
            const vs = vectorScaled.getEndPoint();
            const scaled = { x: va.x * slider.value, y: va.y * slider.value };

            vs.set(scaled.x, scaled.y);
            info.querySelector("#info-a").textContent = `(${va.x.toFixed(1)}, ${va.y.toFixed(1)})`;
            info.querySelector("#info-scaled").textContent = `(${scaled.x.toFixed(1)}, ${scaled.y.toFixed(1)})`;
        });
    }
}

class VectorMag extends HTMLElement {
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

        document.addEventListener("theme-changed", () => {
            this.render();
        })
    }

    render() {
        const shadow = this.shadowRoot;
        const isDark = document.querySelector("html").classList.contains("dark");

        const colors = {
            background: isDark ? "#171717" : "#fafafa",
            grid: isDark ? "#262626" : "#f5f5f5",
            axis: isDark ? "#525252" : "#0a0a0a",
            vectorA: isDark ? "#f43f5e" : "#f43f5e",
            vectorB: isDark ? "#65a30d" : "#65a30d",
        };

        const vectorStrokeWidth = 0.15;

        // Empty the shadowDom
        shadow.innerHTML = "";

        // Style
        const style = document.createElement("style");
        style.textContent = `
            :host {
                display: block;
            }
            .wrapper {
                background: ${colors.background};
                padding: 2rem 2rem 0 2rem;
            }
            .grid-line {
                stroke: ${colors.grid};
                stroke-width: 0.05;
            }
            .axis-line {
                stroke: ${colors.axis};
                stroke-width: 0.05;
            }
            .vector-label {
                user-select: none;
                pointer-events: none;
                font-family: "Geist Mono", monospace;
                font-size: 0.04rem;
                font-weight: 500;
            }
            .handle {
                touch-action: none;
            }
            .info-panel {
                width: 100%;
                display: flex;
                justify-content: center;
                align-items: center;
                flex-wrap: wrap;
                gap: 0.75rem;
                padding: 1rem 0;
            }
            .vector-info {
                background: ${colors.grid};
                padding: 0.4rem 0;
                border-radius: 0.3rem;
                white-space: nowrap;
                width: 10rem;
                text-align: center;
            }
            .vector-info.a {
                color: ${colors.vectorA};
                background: #fecdd3;
            }
            .vector-info.scaled {
                color: ${colors.vectorB};
                background: #ecfccb;
            }
        `;
        shadow.appendChild(style);

        // Create wrapping div
        const div = document.createElement("div");
        div.classList.add("wrapper");
        shadow.appendChild(div);

        // Create SVG canvas
        const svg = createSVGElement("svg", {
            "viewBox": `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`,
        });

        // Create definitions for the SVG
        const defs = createSVGElement("defs");

        // Create arrow(s)
        const arrowA = createSVGElement("marker", {
            "id": "arrowhead-a",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });

        const markerPoly = createSVGElement("polygon", {
            "points": "0 0, 4 2, 0 4"
        });
        arrowA.appendChild(markerPoly);
        defs.appendChild(arrowA);

        const arrowB = createSVGElement("marker", {
            "id": "arrowhead-b",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });
        arrowB.appendChild(markerPoly.cloneNode(true));
        defs.appendChild(arrowB);

        svg.appendChild(defs);

        // Background
        // Horizontal grid lines
        for (let i = this.bounds.y + 1; i < (this.bounds.y + this.bounds.height); ++i) {
            const line = createSVGElement("line", {
                x1: this.bounds.x,
                y1: i,
                x2: this.bounds.x + this.bounds.width,
                y2: i
            });
            line.classList.add("grid-line");
            svg.appendChild(line);
        }
        
        // Vertical grid lines
        for (let i = this.bounds.x + 1; i < (this.bounds.x + this.bounds.width); ++i) {
            const line = createSVGElement("line", {
                x1: i,
                y1: this.bounds.y,
                x2: i,
                y2: this.bounds.y + this.bounds.height,
            });
            line.classList.add("grid-line");
            svg.appendChild(line);
        }

        // X-axis
        const axisX = createSVGElement("line", {
            "x1": 0,
            "y1": this.bounds.y,
            "x2": 0,
            "y2": this.bounds.y + this.bounds.height
        });
        // Y-axis
        const axisY = createSVGElement("line", {
            "x1": this.bounds.x,
            "y1": 0,
            "x2": this.bounds.x + this.bounds.width,
            "y2": 0
        });

        axisX.classList.add("axis-line");
        axisY.classList.add("axis-line");

        svg.appendChild(axisX);
        svg.appendChild(axisY);

        const g_flip = createSVGElement("g", {
            transform: "scale(1 -1)"
        });
        svg.appendChild(g_flip);

        // Create points for vectors (unconventionally: tail and head)
        const p00 = new Point("p00", 0, 0);
        const v1 = new Point("v1", 5, 5);
        const ra = new Point("ra", 5, 0);

        new Vector({
            start: v1,
            end: ra,
            label: {
                text: "Ay",
                offset: -0.6
            },
            parent: g_flip,
            key: "opposite",
            stroke: {
                width: 0.1,
                color: colors.vectorB
            },
        });

        new Vector({
            start: p00,
            end: ra,
            label: {
                text: "Ax",
                offset: 0.6
            },
            parent: g_flip,
            key: "adjacent",
            stroke: {
                width: 0.1,
                color: colors.vectorB
            },
        });

        const vector = new Vector({
            start: p00,
            end: v1,
            label: {
                text: "A",
                offset: -0.5
            },
            parent: g_flip,
            key: "vector",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorA
            },
            marker: arrowA
        });

        // Add handles
        new Handle({
            point: vector.getEndPoint(),
            radius: 1.2,
            interactive: true,
            parent: g_flip
        });

        // Append svg to shadow DOM
        div.appendChild(svg);

        function vLen(point) {
            return Math.sqrt(point.x * point.x + point.y * point.y);
        }

        // Create displays at the bottom
        const info = document.createElement("div");
        info.classList.add("info-panel");
        info.innerHTML = `
            <div class="vector-info a">A: <span id="info-a">(${vector.getStr()})</span></div>
            <div class="vector-info length">Length: <span id="info-length">${vLen(v1).toFixed(1)}</span></div>
        `;
        div.appendChild(info);

        v1.onChange(() => {
            ra.set(v1.x, 0);
            info.querySelector("#info-a").textContent = `(${v1.x.toFixed(1)}, ${v1.y.toFixed(1)})`;
            info.querySelector("#info-length").textContent = vLen(v1).toFixed(1);
        });
    }
}

customElements.define("vector-add", VectorAdd);
customElements.define("vector-sub", VectorSub);
customElements.define("vector-scale", VectorScale);
customElements.define("vector-mag", VectorMag);

export { VectorAdd, VectorSub, VectorScale, VectorMag };
