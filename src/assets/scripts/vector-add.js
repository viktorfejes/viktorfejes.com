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

    return { x: midX + offsetX, y: midY + offsetY };
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

function project3DToIsometric(x, y, z) {
    // Isometric projection matrix
    // Standard isometric: 30° angles
    const cos30 = Math.cos(Math.PI / 6); // 0.866
    const sin30 = Math.sin(Math.PI / 6); // 0.5

    // 2:1 aspect ratio tiles (pixel art style)
    const isoAngle = Math.atan(0.5);
    const cos = Math.cos(isoAngle);
    const sin = Math.sin(isoAngle);

    return {
        x: (x - y) * cos,
        y: (x + y) * sin - z
    };
}

function screenToIsometric(sx, sy) {
    const isoAngle = Math.atan(0.5);
    const cos = Math.cos(isoAngle);
    const sin = Math.sin(isoAngle);

    const x = (sx / cos + sy / sin) / 2;
    const y = (sy / sin - sx / cos) / 2;

    return { x, y, z: 0 };
}

function calculateIsoBounds(bounds) {
    const diagonal = Math.sqrt(bounds.width * bounds.width + bounds.height * bounds.height);
    return {
        x: Math.floor(bounds.x - diagonal),
        y: Math.floor(bounds.y - diagonal),
        width: Math.floor(bounds.width + 2 * diagonal),
        height: Math.floor(bounds.height + 2 * diagonal)
    };
}

function rotateVectorFromPoints(p0, p1, angle) {
    const rad = angle * (Math.PI / 180);

    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Find midpoint
    const M = {
        x: (p0.x + p1.x) * 0.5,
        y: (p0.y + p1.y) * 0.5,
    };

    // Translate and rotate points
    const p0R = {
        x: (p0.x - M.x) * cos - (p0.y - M.y) * sin,
        y: (p0.x - M.x) * sin + (p0.y - M.y) * cos
    };
    const p1R = {
        x: (p1.x - M.x) * cos - (p1.y - M.y) * sin,
        y: (p1.x - M.x) * sin + (p1.y - M.y) * cos
    };

    // Translate back to original position and return
    return [
        vectorAdd(p0R, M),
        vectorAdd(p1R, M)
    ];
}

function vectorAdd(a, b) {
    return {
        x: a.x + b.x,
        y: a.y + b.y
    };
}

function vectorSubtract(a, b) {
    return {
        x: a.x - b.x,
        y: a.y - b.y
    };
}

function vectorDot(a, b) {
    return a.x * b.x + a.y * b.y;
}

function vectorMag(p) {
    return Math.sqrt(p.x * p.x + p.y * p.y);
}

function vectorCross(a, b) {
    return a.x * b.y - a.y * b.x;
}

function vectorCrossNorm(a, b) {
    const cross = vectorCross(a, b);
    const len = vectorMag(a) * vectorMag(b);
    return cross / len;
}

function vectorGetNormal(p0, p1) {
    const d = vectorSubtract(p1, p0);
    const normal = { x: -d.y, y: d.x };
    return normal;
}

function vectorReflect(V, N) {
    // Normalize N just in case it's not normalized
    const Nlen = vectorMag(N);
    const n = { x: N.x / Nlen, y: N.y / Nlen };
    const dotVn = vectorDot(V, n);
    return {
        x: V.x - 2 * dotVn * n.x,
        y: V.y - 2 * dotVn * n.y
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
            flipY: false,
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

        // Dash
        if (this.stroke.dasharray) {
            this.line.setAttribute("stroke-dasharray", this.stroke.dasharray);
        }

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
            });

            // See if we need to flip the label on Y
            if (!label.flipY) {
                this.labelEl.setAttribute("transform", "scale(1 -1)");
            }

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
        const { x: sx, y: sy } = this.start;
        let { x: ex, y: ey } = this.end;

        if (this.marker) {
            const { x: lineX, y: lineY } = calculateVectorLineLength(
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
            let { x: labelX, y: labelY } = calculateLabelPosition(sx, sy, ex, ey, this.label.offset);
            labelY *= this.label.flipY ? 1 : -1;
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

    getStr() {
        return `${this.end.x.toFixed(1)}, ${this.end.y.toFixed(1)}`;
    }
}

class Polygon {
    constructor({
        points,
        label = {},
        fill = "none",
        stroke = {},
        parent,
        key,
    }) {

        // Defaults for objects
        this.stroke = {
            width: 0.1,
            color: "none",
            ...stroke
        };
        this.label = {
            text: "",
            offset: 0.5,
            flipY: false,
            color: this.stroke.color,
            ...label
        };

        this.points = points;
        this.pointCount = points.length;
        this.fill = fill;
        this.parent = parent;
        this.key = key;

        // Group
        this.group = createSVGElement("g");

        // Polygon
        this.poly = createSVGElement("polygon", {
            points: this.points.map(p => `${p.x},${p.y}`).join(" "),
            fill: this.fill,
            stroke: this.stroke.color,
            "stroke-width": this.stroke.width
        });

        // Dash
        if (this.stroke.dasharray) {
            this.line.setAttribute("stroke-dasharray", this.stroke.dasharray);
        }

        // Append line to the group
        this.group.appendChild(this.poly);

        // Label
        if (label) {
            this.labelEl = createSVGElement("text", {
                fill: this.label.color,
                "text-anchor": "middle",
                "dominant-baseline": "middle",
            });

            // See if we need to flip the label on Y
            if (!label.flipY) {
                this.labelEl.setAttribute("transform", "scale(1 -1)");
            }

            this.labelEl.textContent = label.text;
            this.labelEl.classList.add("poly-label", `poly-label--${this.key}`);

            this.group.appendChild(this.labelEl);
        }

        // Append to parent
        this.parent.appendChild(this.group);

        // Add listeners to points so they can call this update
        for (let p of this.points) {
            p.onChange(() => this.update());
        }

        this.update();
    }

    update() {
        this.poly.setAttribute("points", this.points.map(p => `${p.x},${p.y}`).join(" "));

        if (this.labelEl) {
            // Average points positions to find label position
            let x = 0;
            let y = 0;
            for (const p of this.points) {
                x += p.x;
                y += p.y;
            }

            x /= this.pointCount;
            y /= this.pointCount;
            y *= this.label.flipY ? 1 : -1;

            this.labelEl.setAttribute("x", x);
            this.labelEl.setAttribute("y", y);
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

const baseStyles = new CSSStyleSheet();
baseStyles.replaceSync(`
    :host {
        /* Color variable defaults */
        --vo-background: #fafafa;
        --vo-grid: #f5f5f5;
        --vo-axes: #0a0a0a;
        --vo-line-red: #f43f5e;
        --vo-line-green: #65a30d;
        --vo-line-blue: #0284c7;
        --vo-line-yellow: #facc15;
        --vo-line-grey: #e5e5e5;
        --vo-info-red-primary: #f43f5e;
        --vo-info-red-secondary: #fecdd3;
        --vo-info-green-primary: #65a30d;
        --vo-info-green-secondary: #ecfccb;
        --vo-info-blue-primary: #0284c7;
        --vo-info-blue-secondary: #e0f2fe;
        --vo-info-yellow-primary: #facc15;
        --vo-info-yellow-secondary: #fefce8;

        /* Font variable defaults */
        --vo-font-primary: inherit;
        --vo-font-label-size: 0.04rem;
        --vo-font-label-weight: 500;

        display: block;
    }
    .wrapper {
        background: var(--vo-background);
        padding: 2rem 2rem 0 2rem;
    }
    svg { touch-action: none; }
    .grid-line {
        stroke: var(--vo-grid);
        stroke-width: 0.05;
    }
    .axis-line {
        stroke: var(--vo-axes);
        stroke-width: 0.05;
    }
    .vector-label {
        font-family: var(--vo-font-primary);
        font-size: var(--vo-font-label-size);
        font-weight: var(--vo-font-label-weight);
        user-select: none;
        pointer-events: none;
    }
    .stroke-red { stroke: var(--vo-line-red); }
    .stroke-green { stroke: var(--vo-line-green); }
    .stroke-blue { stroke: var(--vo-line-blue); }
    .stroke-yellow { stroke: var(--vo-line-yellow); }
    .stroke-grey { stroke: var(--vo-line-grey); }
    .fill-red { fill: var(--vo-line-red); }
    .fill-green { fill: var(--vo-line-green); }
    .fill-blue { fill: var(--vo-line-blue); }
    .fill-yellow { fill: var(--vo-line-yellow); }
    .fill-grey { fill: var(--vo-line-grey); }
`);

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
        this.attachShadow({ mode: "open" });
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
            vectorAux: isDark ? "#262626" : "#e5e5e5",
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
        this.attachShadow({ mode: "open" });
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
            vectorAux: isDark ? "#262626" : "#e5e5e5",
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
        this.attachShadow({ mode: "open" });
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
        this.attachShadow({ mode: "open" });
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
                color: colors.vectorB,
                dasharray: "0.3 0.1"
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
                color: colors.vectorB,
                dasharray: "0.3 0.1"
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

class VectorDot extends HTMLElement {
    constructor() {
        super();

        this.bounds = {
            x: -10,
            y: -8,
            width: 20,
            height: 16
        };

        // Create shadow DOM
        this.attachShadow({ mode: "open" });
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
            vectorProj: isDark ? "#facc15" : "#facc15",
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
            .vector-info.b {
                color: ${colors.vectorB};
                background: #ecfccb;
            }
            .vector-info.dot {
                color: ${colors.vectorProj};
                background: #fefce8;
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
        const v1 = new Point("v1", 6, 0);
        const v2 = new Point("v2", 2, 5);
        const vp = new Point("vp", 2, 0);

        const vectorA = new Vector({
            start: p00,
            end: v1,
            label: {
                text: "a",
                offset: -0.6
            },
            parent: g_flip,
            key: "vectorA",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorA,
            },
            marker: arrowA
        });

        const vectorB = new Vector({
            start: p00,
            end: v2,
            label: {
                text: "b",
                offset: 0.6
            },
            parent: g_flip,
            key: "vectorB",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorB,
            },
            marker: arrowB
        });

        const projection = new Vector({
            start: p00,
            end: vp,
            label: {
                text: "",
                offset: -0.5
            },
            parent: g_flip,
            key: "dot",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorProj
            },
        });

        // Add handles
        new Handle({
            point: v1,
            radius: 1.2,
            interactive: true,
            parent: g_flip
        });
        new Handle({
            point: v2,
            radius: 1.2,
            interactive: true,
            parent: g_flip
        });

        // Append svg to shadow DOM
        div.appendChild(svg);

        function vLen(point) {
            return Math.sqrt(point.x * point.x + point.y * point.y);
        }

        function dot(a, b) {
            return a.x * b.x + a.y * b.y;
        }

        function round(x, decimals = 2) {
            const factor = 10 ** decimals;
            return Math.round(x * factor) / factor;
        }

        // Create displays at the bottom
        const info = document.createElement("div");
        info.classList.add("info-panel");
        info.innerHTML = `
            <div class="vector-info a">A: <span id="info-a">(${vectorA.getStr()})</span></div>
            <div class="vector-info b">B: <span id="info-b">(${vectorB.getStr()})</span></div>
            <div class="vector-info dot">A⋅B: <span id="info-dot">${dot(v1, v2).toFixed(1)}</span></div>
        `;
        div.appendChild(info);

        v1.onChange(() => {
            const newDot = dot(v1, v2);
            const lenSq = dot(v1, v1);
            const t = newDot / lenSq;

            vp.set(v1.x * t, v1.y * t);
            info.querySelector("#info-a").textContent = `(${v1.x.toFixed(1)}, ${v1.y.toFixed(1)})`;
            info.querySelector("#info-dot").textContent = newDot.toFixed(1);
        });

        v2.onChange(() => {
            const newDot = dot(v1, v2);
            const lenSq = dot(v1, v1);
            const t = newDot / lenSq;

            vp.set(v1.x * t, v1.y * t);
            info.querySelector("#info-b").textContent = `(${v2.x.toFixed(1)}, ${v2.y.toFixed(1)})`;
            info.querySelector("#info-dot").textContent = newDot.toFixed(1);
        });
    }
}

class VectorCross extends HTMLElement {
    constructor() {
        super();

        this.bounds = {
            x: -10,
            y: -10,
            width: 20,
            height: 20
        };

        this.v1 = { x: 0, y: 6 };
        this.v2 = { x: 6, y: 0 };
        this.pp = { x: 6, y: 6 };

        // Create shadow DOM
        this.attachShadow({ mode: "open" });
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
            vectorC: isDark ? "#0284c7" : "#0284c7",
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
            .vector-label,
            .poly-label {
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
            .vector-info.b {
                color: ${colors.vectorB};
                background: #ecfccb;
            }
            .vector-info.dot {
                color: ${colors.vectorC};
                background: #fefce8;
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

        const arrowC = createSVGElement("marker", {
            "id": "arrowhead-c",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });
        arrowC.appendChild(markerPoly.cloneNode(true));
        defs.appendChild(arrowC);

        svg.appendChild(defs);

        // Background
        const isoBounds = calculateIsoBounds(this.bounds);
        // Horizontal grid lines
        for (let i = isoBounds.y; i < (isoBounds.y + isoBounds.height); ++i) {
            const start = project3DToIsometric(isoBounds.x, i, 0);
            const end = project3DToIsometric(isoBounds.x + isoBounds.width, i, 0);

            const line = createSVGElement("line", {
                x1: start.x,
                y1: start.y,
                x2: end.x,
                y2: end.y
            });
            line.classList.add("grid-line");
            svg.appendChild(line);
        }

        // Vertical grid lines
        for (let i = isoBounds.x; i < (isoBounds.x + isoBounds.width); ++i) {
            const start = project3DToIsometric(i, isoBounds.y, 0);
            const end = project3DToIsometric(i, isoBounds.y + isoBounds.height, 0);

            const line = createSVGElement("line", {
                x1: start.x,
                y1: start.y,
                x2: end.x,
                y2: end.y
            });
            line.classList.add("grid-line");
            svg.appendChild(line);
        }

        // X-axis
        const axisXStart = project3DToIsometric(0, isoBounds.y, 0);
        const axisXEnd = project3DToIsometric(0, isoBounds.y + isoBounds.height, 0);
        const axisX = createSVGElement("line", {
            "x1": axisXStart.x,
            "y1": axisXStart.y,
            "x2": axisXEnd.x,
            "y2": axisXEnd.y
        });
        // Y-axis
        const axisYStart = project3DToIsometric(isoBounds.x, 0, 0);
        const axisYEnd = project3DToIsometric(isoBounds.x + isoBounds.width, 0, 0);
        const axisY = createSVGElement("line", {
            "x1": axisYStart.x,
            "y1": axisYStart.y,
            "x2": axisYEnd.x,
            "y2": axisYEnd.y
        });

        // Z-axis (can be just svg coords)
        const axisZ = createSVGElement("line", {
            "x1": 0,
            "y1": this.bounds.y,
            "x2": 0,
            "y2": this.bounds.y + this.bounds.height
        });

        axisX.classList.add("axis-line");
        axisY.classList.add("axis-line");
        axisZ.classList.add("axis-line");

        svg.appendChild(axisX);
        svg.appendChild(axisY);
        svg.appendChild(axisZ);
        //
        // const g_flip = createSVGElement("g", {
        //     transform: "scale(1 -1)"
        // });
        // svg.appendChild(g_flip);

        // Create points for vectors (unconventionally: tail and head)
        const p00 = new Point("p00", 0, 0);
        const test = project3DToIsometric(this.v1.x, this.v1.y, 0);
        const test2 = project3DToIsometric(this.v2.x, this.v2.y, 0);
        const v1 = new Point("v1", test.x, test.y);
        const v2 = new Point("v2", test2.x, test2.y);

        // Cross product vector
        const axb = this.v1.x * this.v2.y - this.v1.y * this.v2.x;
        // NOTE: Need to flip the Y because of the nature of SVG canvas
        const pcross = project3DToIsometric(0, 0, -axb * 0.2);
        const vcross = new Point("cross", pcross.x, pcross.y);

        // Define the parallelogram's point that A and B encompass
        const asumb = project3DToIsometric(this.pp.x, this.pp.y, 0);
        const ptip = new Point("ptip", asumb.x, asumb.y);

        // Draw the parallelogram
        const parallelogram = new Polygon({
            points: [p00, v2, ptip, v1],
            parent: svg,
            fill: "rgba(254, 249, 195, 0.25)",
            key: "par",
            label: {
                text: "|AxB|",
                flipY: true,
                color: "#ca8a04"
            },
            stroke: {
                width: 0.05,
                color: "rgba(254, 249, 195, 0.5)"
            }
        });

        const vectorA = new Vector({
            start: p00,
            end: v1,
            label: {
                text: "A",
                offset: 0.6,
                flipY: true
            },
            parent: svg,
            key: "vectorA",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorA,
            },
            marker: arrowA
        });

        const vectorB = new Vector({
            start: p00,
            end: v2,
            label: {
                text: "B",
                offset: -0.6,
                flipY: true
            },
            parent: svg,
            key: "vectorB",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorB,
            },
            marker: arrowB
        });

        const vectorC = new Vector({
            start: p00,
            end: vcross,
            label: {
                text: "AxB",
                offset: 0.8,
                flipY: true
            },
            parent: svg,
            key: "vectorC",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorC,
            },
            marker: arrowC
        });

        // Add handles
        new Handle({
            point: v1,
            radius: 1.2,
            interactive: true,
            parent: svg
        });
        new Handle({
            point: v2,
            radius: 1.2,
            interactive: true,
            parent: svg
        });

        // Append svg to shadow DOM
        div.appendChild(svg);

        // Create displays at the bottom
        const info = document.createElement("div");
        info.classList.add("info-panel");
        info.innerHTML = `
            <div class="vector-info a">A: <span id="info-a">(${vectorA.getStr()})</span></div>
            <div class="vector-info b">B: <span id="info-b">(${vectorB.getStr()})</span></div>
            <div class="vector-info cross">A x B: <span id="info-cross">${-vectorCross(v1, v2).toFixed(1)}</span></div>
        `;
        div.appendChild(info);

        v1.onChange(() => {
            // Update the parallelogram's tip
            const s = { x: v1.x + v2.x, y: v1.y + v2.y };
            ptip.set(s.x, s.y);

            const stoi = screenToIsometric(v1.x, v1.y);
            const stoi2 = screenToIsometric(v2.x, v2.y);

            // Recalculate cross product and update vector
            const c = vectorCross(stoi, stoi2);
            const pc = project3DToIsometric(0, 0, -c * 0.2);
            vcross.set(pc.x, pc.y);

            info.querySelector("#info-a").textContent = `(${v1.x.toFixed(1)}, ${v1.y.toFixed(1)})`;
            info.querySelector("#info-cross").textContent = -c.toFixed(1);
        });

        v2.onChange(() => {
            // Update the parallelogram's tip
            const s = { x: v1.x + v2.x, y: v1.y + v2.y };
            ptip.set(s.x, s.y);

            const stoi = screenToIsometric(v1.x, v1.y);
            const stoi2 = screenToIsometric(v2.x, v2.y);

            // Recalculate cross product and update vector
            const c = vectorCross(stoi, stoi2);
            const pc = project3DToIsometric(0, 0, -c * 0.2);
            vcross.set(pc.x, pc.y);

            info.querySelector("#info-b").textContent = `(${v2.x.toFixed(1)}, ${v2.y.toFixed(1)})`;
            info.querySelector("#info-cross").textContent = -c.toFixed(1);
        });
    }
}

class VectorReflect extends HTMLElement {
    constructor() {
        super();

        this.bounds = {
            x: -10,
            y: -8,
            width: 20,
            height: 16
        };

        // To store the mirror's default
        this.mirror = [
            { x: -6, y: 0 },
            { x: 6, y: 0 }
        ];

        // Create shadow DOM
        this.attachShadow({ mode: "open" });
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
            vectorProj: isDark ? "#facc15" : "#facc15",
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
            .vector-info.v {
                color: #fecdd3;
                background: #4c0519;
            }
            .vector-info.r {
                color: #ecfccb;
                background: #1a2e05;
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

        const arrowN = createSVGElement("marker", {
            "id": "arrowhead-n",
            "markerWidth": 4,
            "markerHeight": 4,
            "orient": "auto",
            "refX": 3.1,
            "refY": 2
        });
        arrowN.appendChild(markerPoly.cloneNode(true));
        defs.appendChild(arrowN);

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
        const m0 = new Point("m0", this.mirror[0].x, this.mirror[0].y);
        const m1 = new Point("m1", this.mirror[1].x, this.mirror[1].y);
        const n = new Point("n1", 0, 3);
        const Vtail = new Point("v", -4, 4);
        const Rhead = new Point("r", 4, 4);

        const mirror = new Vector({
            start: m0,
            end: m1,
            label: {
                text: "mirror",
                offset: 0.6
            },
            parent: g_flip,
            key: "surface",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorProj,
            }
        });

        const normal = new Vector({
            start: p00,
            end: n,
            label: {
                text: "N",
                offset: 0.6
            },
            parent: g_flip,
            key: "normal",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorProj,
            },
            marker: arrowN
        });

        const V = new Vector({
            start: Vtail,
            end: p00,
            label: {
                text: "V",
                offset: 0.6
            },
            parent: g_flip,
            key: "V",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorA,
            },
            marker: arrowA
        });

        const R = new Vector({
            start: p00,
            end: Rhead,
            label: {
                text: "R",
                offset: 0.6
            },
            parent: g_flip,
            key: "R",
            stroke: {
                width: vectorStrokeWidth,
                color: colors.vectorB,
            },
            marker: arrowB
        });

        // Add handles
        new Handle({
            point: Vtail,
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
            <label>Mirror angle: </label>
            <input type="range" id="scale-slider" min="-45.0" max="45.0" step="0.5" value="0.0">
            <span id="scale-value">0.0°</span>
        `;
        const scaleSlider = control.querySelector("#scale-slider");
        const scaleValue = control.querySelector("#scale-value");
        div.appendChild(control);

        // Create displays at the bottom
        const info = document.createElement("div");
        info.classList.add("info-panel");
        info.innerHTML = `
            <div class="vector-info v">V: <span id="info-v">(${V.getStr()})</span></div>
            <div class="vector-info r">R: <span id="info-r">(${R.getStr()})</span></div>
        `;
        div.appendChild(info);

        Vtail.onChange(() => {
            const v = vectorSubtract(p00, Vtail);
            const reflect = vectorReflect(v, n);

            Rhead.set(reflect.x, reflect.y);
            info.querySelector("#info-v").textContent = `(${Vtail.x.toFixed(1)}, ${Vtail.y.toFixed(1)})`;
            info.querySelector("#info-r").textContent = `(${reflect.x.toFixed(1)}, ${reflect.y.toFixed(1)})`;
        });

        scaleSlider.addEventListener("input", (e) => {
            const angle = parseFloat(e.target.value);
            const rotatedLine = rotateVectorFromPoints(this.mirror[0], this.mirror[1], angle);
            m0.set(rotatedLine[0].x, rotatedLine[0].y);
            m1.set(rotatedLine[1].x, rotatedLine[1].y);

            // Update normal
            const nr = vectorGetNormal(rotatedLine[0], rotatedLine[1]);
            n.set(nr.x * 0.25, nr.y * 0.25);
            scaleValue.textContent = `${angle.toFixed(1)}°`;

            // Update reflection
            const v = vectorSubtract(p00, Vtail);
            const reflect = vectorReflect(v, n);

            Rhead.set(reflect.x, reflect.y);
            info.querySelector("#info-r").textContent = `(${reflect.x.toFixed(1)}, ${reflect.y.toFixed(1)})`;
        });
    }
}

customElements.define("vector-add", VectorAdd);
customElements.define("vector-sub", VectorSub);
customElements.define("vector-scale", VectorScale);
customElements.define("vector-mag", VectorMag);
customElements.define("vector-dot", VectorDot);
customElements.define("vector-cross", VectorCross);
customElements.define("vector-reflect", VectorReflect);

export { VectorAdd, VectorSub, VectorScale, VectorMag, VectorDot, VectorCross, VectorReflect };
