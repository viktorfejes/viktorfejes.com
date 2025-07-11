function createSVGElement(tag, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }
    return element;
}

function createLine(p0, p1, strokeWidth, dashArray = "none", arrowEnd = true) {
    let lineEnd = { x: p1.x, y: p1.y };
    
    // Create the group to group these together as a "vector"
    const g = createSVGElement("g");

    // Calculate arrow dimensions from strokeWidth
    const arrowLength = strokeWidth * Math.PI;
    const arrowWidth = arrowLength * 0.5;

    let normVec = {};

    if (arrowEnd) {
        // Calculate the direction vector
        const vec = vectorSubtract(p1, p0);
        const len = vectorMag(vec);
        normVec.x = vec.x / len;
        normVec.y = vec.y / len;

        // Calculate where the line should end (before the arrowhead)
        lineEnd.x = p1.x - (normVec.x * arrowLength);
        lineEnd.y = p1.y - (normVec.y * arrowLength);
    }

    // Draw the line part of the vector
    const line = createSVGElement("line", {
        x1: p0.x, y1: p0.y,
        x2: lineEnd.x, y2: lineEnd.y,
        "stroke-width": strokeWidth,
        stroke: "currentColor",
        "stroke-dasharray": dashArray
    });
    g.appendChild(line);

    if (arrowEnd) {
        // Create the arrowhead points
        const perpVec = { x: -normVec.y, y: normVec.x };

        const arrowCorner1 = {
            x: lineEnd.x + (perpVec.x * arrowWidth),
            y: lineEnd.y + (perpVec.y * arrowWidth)
        };

        const arrowCorner2 = {
            x: lineEnd.x - (perpVec.x * arrowWidth),
            y: lineEnd.y - (perpVec.y * arrowWidth)
        };

        // Draw the head
        const head = createSVGElement("polygon", {
            points: `${arrowCorner1.x},${arrowCorner1.y} ${arrowCorner2.x},${arrowCorner2.y} ${p1.x},${p1.y}`,
            fill: "currentColor"
        });

        g.appendChild(head);
    }

    return g;
}

function updateLine(g, p0, p1) {
    const line = g.children[0];
    const arrow = g.children[1];

    if (!arrow) {
        // no arrowhead, just update line
        line.setAttribute("x1", p0.x);
        line.setAttribute("y1", p0.y);
        line.setAttribute("x2", p1.x);
        line.setAttribute("y2", p1.y);
        return;
    }

    // Get attributes
    const strokeWidth = parseFloat(line.getAttribute("stroke-width"));
    const arrowLength = strokeWidth * Math.PI;
    const arrowWidth = arrowLength * 0.5;

    // Calculate new positions
    const vec = vectorSubtract(p1, p0);
    const len = vectorMag(vec);
    const normVec = { x: vec.x / len, y: vec.y / len };
    
    const lineEnd = {
        x: p1.x - (normVec.x * arrowLength),
        y: p1.y - (normVec.y * arrowLength),
    };

    // Update line
    line.setAttribute("x1", p0.x);
    line.setAttribute("y1", p0.y);
    line.setAttribute("x2", lineEnd.x);
    line.setAttribute("y2", lineEnd.y);

    // Update arrowhead
    const perpVec = { x: -normVec.y, y: normVec.x };
    const c1 = {
        x: lineEnd.x + (perpVec.x * arrowWidth),
        y: lineEnd.y + (perpVec.y * arrowWidth)
    };

    const c2 = {
        x: lineEnd.x - (perpVec.x * arrowWidth),
        y: lineEnd.y - (perpVec.y * arrowWidth)
    };

    // Draw the head
    arrow.setAttribute("points", `${c1.x},${c1.y} ${c2.x},${c2.y} ${p1.x},${p1.y}`);
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

function project3DToIsometric(x, y, z) {
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
        marker = true
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
            dasharray: "none",
            ...stroke
        };

        this.start = start;
        this.end = end;
        this.parent = parent;
        this.key = key;
        this.marker = marker;

        // Group
        this.group = createSVGElement("g");
        this.group.classList.add(this.key);

        // Create vector line (with arrow if marker is true)
        this.vector = createLine(this.start, this.end, this.stroke.width, this.stroke.dasharray, this.marker);
        this.group.appendChild(this.vector);

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

        updateLine(this.vector, this.start, this.end);

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
        stroke = {},
        parent,
        key,
    }) {

        // Defaults for objects
        this.stroke = {
            width: 0.1,
            ...stroke
        };
        this.label = {
            text: "",
            offset: 0.5,
            flipY: false,
            ...label
        };

        this.points = points;
        this.pointCount = points.length;
        this.parent = parent;
        this.key = key;

        // Group
        this.group = createSVGElement("g");
        this.group.classList.add(this.key);

        // Polygon
        this.poly = createSVGElement("polygon", {
            points: this.points.map(p => `${p.x},${p.y}`).join(" "),
            "stroke-width": this.stroke.width
        });
        this.poly.classList.add("polygon", `polygon--${this.key}`);

        // Dash
        if (this.stroke.dasharray) {
            this.line.setAttribute("stroke-dasharray", this.stroke.dasharray);
        }

        // Append line to the group
        this.group.appendChild(this.poly);

        // Label
        if (label) {
            this.labelEl = createSVGElement("text", {
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

            this.el.addEventListener("pointerdown", () => {
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
    --background: #fafafa;
    --grid: #f5f5f5;
    --axes: #0a0a0a;
    --line-red: #f43f5e;
    --line-green: #65a30d;
    --line-blue: #0284c7;
    --line-yellow: #facc15;
    --line-grey: #e5e5e5;
    --info-red-primary: #f43f5e;
    --info-red-secondary: #fecdd3;
    --info-green-primary: #65a30d;
    --info-green-secondary: #ecfccb;
    --info-blue-primary: #0284c7;
    --info-blue-secondary: #e0f2fe;
    --info-yellow-primary: #facc15;
    --info-yellow-secondary: #fefce8;

    /* Font variable defaults */
    --font-primary: inherit;
    --font-label-size: 0.04rem;
    --font-label-weight: 500;

    display: block;
}
.wrapper {
    background: var(--background);
    padding: 2rem 2rem 0 2rem;
}
svg { touch-action: none; }
.grid-line {
    stroke: var(--grid);
    stroke-width: 0.05;
}
.axis-line {
    stroke: var(--axes);
    stroke-width: 0.05;
}
.vector-line { stroke: currentColor; }
.polygon {
    stroke: currentColor;
    fill: currentColor;
}
.vector-label,
.poly-label {
    font-family: var(--font-primary);
    font-size: var(--font-label-size);
    font-weight: var(--font-label-weight);
    user-select: none;
    pointer-events: none;
    fill: currentColor;
}
.control-panel,
.info-panel {
    width: 100%;
    display: flex;
    place-content: center;
    gap: 1rem;
    padding: 1rem 0;
}
.vector-info {
    padding: 0.4rem 0;
    border-radius: 0.3rem;
    white-space: nowrap;
    width: 10rem;
    text-align: center;
}
`);

const vectorAddStyles = new CSSStyleSheet();
vectorAddStyles.replaceSync(`
.vectorA { color: var(--line-red); }
.vectorB { color: var(--line-green); }
.vectorSum { color: var(--line-blue); }
.vectorAux { color: var(--line-grey); }
.vector-info.a {
    color: var(--info-red-primary);
    background: var(--info-red-secondary);
}
.vector-info.b {
    color: var(--info-green-primary);
    background: var(--info-green-secondary);
}
.vector-info.sum {
    color: var(--info-blue-primary);
    background: var(--info-blue-secondary);
}
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
        this.attachShadow({ mode: "open" }).adoptedStyleSheets = [baseStyles, vectorAddStyles];
    }

    connectedCallback() {
        const shadow = this.shadowRoot;
        const vectorStrokeWidth = 0.15;

        // Create wrapping div
        const div = document.createElement("div");
        div.classList.add("wrapper");
        shadow.appendChild(div);

        // Create SVG canvas
        const svg = createSVGElement("svg", {
            "viewBox": `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`,
        });

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
        const pA = new Point("pa", 9, 3);
        const pB = new Point("pb", -4, 4);
        const pSum = new Point("psum", 5, 7);

        const vectorA = new Vector({
            start: p00,
            end: pA,
            label: {
                text: "A",
            },
            parent: g_flip,
            key: "vectorA",
            stroke: {
                width: vectorStrokeWidth,
            },
        });

        const vectorB = new Vector({
            start: p00,
            end: pB,
            label: {
                text: "B",
                offset: -0.5
            },
            parent: g_flip,
            key: "vectorB",
            stroke: {
                width: vectorStrokeWidth,
            },
        });

        new Vector({
            start: pA,
            end: pSum,
            parent: g_flip,
            key: "vectorAux",
            label: {
                text: "B"
            },
            stroke: {
                width: vectorStrokeWidth,
                dasharray: "0.3 0.1"
            },
        });

        new Vector({
            start: pB,
            end: pSum,
            parent: g_flip,
            key: "vectorAux",
            label: {
                text: "A",
                offset: -0.5
            },
            stroke: {
                width: vectorStrokeWidth,
                dasharray: "0.3 0.1"
            },
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
            },
        });

        // Add handles
        new Handle({
            point: pA,
            radius: 1.2,
            interactive: true,
            parent: g_flip
        });
        new Handle({
            point: pB,
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
        const infoA = info.querySelector("#info-a");
        const infoB = info.querySelector("#info-b");
        const infoSum = info.querySelector("#info-sum");
        div.appendChild(info);

        vectorA.getEndPoint().onChange(() => {
            pSum.set(pA.x + pB.x, pA.y + pB.y);
            infoA.textContent = `(${pA.x.toFixed(1)}, ${pA.y.toFixed(1)})`;
            infoSum.textContent = `(${pSum.x.toFixed(1)}, ${pSum.y.toFixed(1)})`;
        });

        vectorB.getEndPoint().onChange(() => {
            pSum.set(pA.x + pB.x, pA.y + pB.y);
            infoB.textContent = `(${pB.x.toFixed(1)}, ${pB.y.toFixed(1)})`;
            infoSum.textContent = `(${pSum.x.toFixed(1)}, ${pSum.y.toFixed(1)})`;
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
        this.attachShadow({ mode: "open" }).adoptedStyleSheets = [baseStyles, vectorAddStyles];
    }

    connectedCallback() {
        const shadow = this.shadowRoot;
        const vectorStrokeWidth = 0.15;

        // Create wrapping div
        const div = document.createElement("div");
        div.classList.add("wrapper");
        shadow.appendChild(div);

        // Create SVG canvas
        const svg = createSVGElement("svg", {
            "viewBox": `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`,
        });

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
        const pA = new Point("pa", 5, 3);
        const pB = new Point("pb", -4, 4);
        const pRes = new Point("pres", -9, 1);

        const vectorA = new Vector({
            start: p00,
            end: pA,
            label: {
                text: "A",
            },
            parent: g_flip,
            key: "vectorA",
            stroke: {
                width: vectorStrokeWidth,
            },
        });

        new Vector({
            start: pA,
            end: pB,
            parent: g_flip,
            key: "vectorAux",
            label: {
                text: "B-A"
            },
            stroke: {
                width: vectorStrokeWidth,
                dasharray: "0.3 0.1"
            },
        });

        const vectorB = new Vector({
            start: p00,
            end: pB,
            label: {
                text: "B"
            },
            parent: g_flip,
            key: "vectorB",
            stroke: {
                width: vectorStrokeWidth,
            },
        });

        const vectorSum = new Vector({
            start: p00,
            end: pRes,
            label: {
                text: "B-A",
                offset: 0.8
            },
            parent: g_flip,
            key: "vectorSum",
            stroke: {
                width: vectorStrokeWidth,
            },
        });

        // Add handles
        new Handle({
            point: pA,
            radius: 1.2,
            interactive: true,
            parent: g_flip
        });
        new Handle({
            point: pB,
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
        const infoA = info.querySelector("#info-a");
        const infoB = info.querySelector("#info-b");
        const infoRes = info.querySelector("#info-sum");
        div.appendChild(info);

        pA.onChange(() => {
            pRes.set(pB.x - pA.x, pB.y - pA.y);
            infoA.textContent = `(${pA.x.toFixed(1)}, ${pA.y.toFixed(1)})`;
            infoRes.textContent = `(${pRes.x.toFixed(1)}, ${pRes.y.toFixed(1)})`;
        });

        pB.onChange(() => {
            pRes.set(pB.x - pA.x, pB.y - pA.y);
            infoB.textContent = `(${pB.x.toFixed(1)}, ${pB.y.toFixed(1)})`;
            infoRes.textContent = `(${pRes.x.toFixed(1)}, ${pRes.y.toFixed(1)})`;
        });
    }
}

const vectorScaleStyles = new CSSStyleSheet();
vectorScaleStyles.replaceSync(`
.vectorBase { color: var(--line-red); }
.vectorScaled { color: var(--line-green); }
.vector-info.base {
    color: var(--info-red-primary);
    background: var(--info-red-secondary);
}
.vector-info.scaled {
    color: var(--info-green-primary);
    background: var(--info-green-secondary);
}
`);
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
        this.attachShadow({ mode: "open" }).adoptedStyleSheets = [baseStyles, vectorScaleStyles];
    }

    connectedCallback() {
        const shadow = this.shadowRoot;
        const vectorStrokeWidth = 0.15;

        // Create wrapping div
        const div = document.createElement("div");
        div.classList.add("wrapper");
        shadow.appendChild(div);

        // Create SVG canvas
        const svg = createSVGElement("svg", {
            "viewBox": `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`,
        });

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
        const pBase = new Point("p-base", 3, 3);
        const pScaled = new Point("p-scaled", 4.5, 4.5);

        const vectorScaled = new Vector({
            start: p00,
            end: pScaled,
            label: {
                text: "Scaled",
                offset: -1.2
            },
            parent: g_flip,
            key: "vectorScaled",
            stroke: {
                width: vectorStrokeWidth,
            },
        });

        const vectorA = new Vector({
            start: p00,
            end: pBase,
            label: {
                text: "Base",
                offset: 1
            },
            parent: g_flip,
            key: "vectorBase",
            stroke: {
                width: vectorStrokeWidth,
            },
        });

        // Add handles
        new Handle({
            point: pBase,
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
        const slider = control.querySelector("#scale-slider");
        const sliderValue = control.querySelector("#scale-value");
        div.appendChild(control);

        // Create displays at the bottom
        const info = document.createElement("div");
        info.classList.add("info-panel");
        info.innerHTML = `
            <div class="vector-info base">Base: <span id="info-a">(${vectorA.getStr()})</span></div>
            <div class="vector-info scaled">Scaled: <span id="info-scaled">(${vectorScaled.getStr()})</span></div>
        `;
        const infoA = info.querySelector("#info-a");
        const infoScaled = info.querySelector("#info-scaled");
        div.appendChild(info);

        slider.addEventListener("input", (e) => {
            const scale = parseFloat(e.target.value);
            const scaled = { x: pBase.x * scale, y: pBase.y * scale };

            pScaled.set(scaled.x, scaled.y);
            sliderValue.textContent = `${scale.toFixed(1)}x`;

            infoA.textContent = `(${pBase.x.toFixed(1)}, ${pBase.y.toFixed(1)})`;
            infoScaled.textContent = `(${scaled.x.toFixed(1)}, ${scaled.y.toFixed(1)})`;
        });

        pBase.onChange(() => {
            const vs = vectorScaled.getEndPoint();
            const scaled = { x: pBase.x * slider.value, y: pBase.y * slider.value };

            vs.set(scaled.x, scaled.y);
            infoA.textContent = `(${pBase.x.toFixed(1)}, ${pBase.y.toFixed(1)})`;
            infoScaled.textContent = `(${scaled.x.toFixed(1)}, ${scaled.y.toFixed(1)})`;
        });
    }
}

const vectorMagStyles = new CSSStyleSheet();
vectorMagStyles.replaceSync(`
.vector { color: var(--line-red); }
.adjacent, .opposite { color: var(--line-green); }
.vector-info.a {
    color: var(--info-red-primary);
    background: var(--info-red-secondary);
}
.vector-info.length {
    color: var(--info-green-primary);
    background: var(--info-green-secondary);
}
`);
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
        this.attachShadow({ mode: "open" }).adoptedStyleSheets = [baseStyles, vectorMagStyles];
    }

    connectedCallback() {
        const shadow = this.shadowRoot;
        const vectorStrokeWidth = 0.15;

        // Create wrapping div
        const div = document.createElement("div");
        div.classList.add("wrapper");
        shadow.appendChild(div);

        // Create SVG canvas
        const svg = createSVGElement("svg", {
            "viewBox": `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`,
        });

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
                dasharray: "0.3 0.1"
            },
            marker: false
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
                dasharray: "0.3 0.1"
            },
            marker: false
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
            },
        });

        // Add handles
        new Handle({
            point: v1,
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
            <div class="vector-info a">A: <span id="info-a">(${vector.getStr()})</span></div>
            <div class="vector-info length">Length: <span id="info-length">${vectorMag(v1).toFixed(1)}</span></div>
        `;
        const infoA = info.querySelector("#info-a");
        const infoLength = info.querySelector("#info-length");

        div.appendChild(info);

        v1.onChange(() => {
            ra.set(v1.x, 0);
            infoA.textContent = `(${v1.x.toFixed(1)}, ${v1.y.toFixed(1)})`;
            infoLength.textContent = vectorMag(v1).toFixed(1);
        });
    }
}

const vectorDotStyles = new CSSStyleSheet();
vectorDotStyles.replaceSync(`
.vectorA { color: var(--line-red); }
.vectorB{ color: var(--line-green); }
.dot{ color: var(--line-yellow); }
.vector-info.a {
    color: var(--info-red-primary);
    background: var(--info-red-secondary);
}
.vector-info.b {
    color: var(--info-green-primary);
    background: var(--info-green-secondary);
}
.vector-info.dot {
    color: var(--info-yellow-primary);
    background: var(--info-yellow-secondary);
}
`);
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
        this.attachShadow({ mode: "open" }).adoptedStyleSheets = [baseStyles, vectorDotStyles];
    }

    connectedCallback() {
        const shadow = this.shadowRoot;
        const vectorStrokeWidth = 0.15;

        // Create wrapping div
        const div = document.createElement("div");
        div.classList.add("wrapper");
        shadow.appendChild(div);

        // Create SVG canvas
        const svg = createSVGElement("svg", {
            "viewBox": `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`,
        });

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
                text: "A",
                offset: 0.6
            },
            parent: g_flip,
            key: "vectorA",
            stroke: {
                width: vectorStrokeWidth,
            },
        });

        const vectorB = new Vector({
            start: p00,
            end: v2,
            label: {
                text: "B",
                offset: -0.6
            },
            parent: g_flip,
            key: "vectorB",
            stroke: {
                width: vectorStrokeWidth,
            },
        });

        new Vector({
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
            },
            marker: false
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

        // Create displays at the bottom
        const info = document.createElement("div");
        info.classList.add("info-panel");
        info.innerHTML = `
            <div class="vector-info a">A: <span id="info-a">(${vectorA.getStr()})</span></div>
            <div class="vector-info b">B: <span id="info-b">(${vectorB.getStr()})</span></div>
            <div class="vector-info dot">A⋅B: <span id="info-dot">${vectorDot(v1, v2).toFixed(1)}</span></div>
        `;
        const infoA = info.querySelector("#info-a");
        const infoB = info.querySelector("#info-b");
        const infoDot = info.querySelector("#info-dot");
        div.appendChild(info);

        v1.onChange(() => {
            const newDot = vectorDot(v1, v2);
            const lenSq = vectorDot(v1, v1);
            const t = newDot / lenSq;

            vp.set(v1.x * t, v1.y * t);
            infoA.textContent = `(${v1.x.toFixed(1)}, ${v1.y.toFixed(1)})`;
            infoDot.textContent = newDot.toFixed(1);
        });

        v2.onChange(() => {
            const newDot = vectorDot(v1, v2);
            const lenSq = vectorDot(v1, v1);
            const t = newDot / lenSq;

            vp.set(v1.x * t, v1.y * t);
            infoB.textContent = `(${v2.x.toFixed(1)}, ${v2.y.toFixed(1)})`;
            infoDot.textContent = newDot.toFixed(1);
        });
    }
}

const vectorCrossStyles = new CSSStyleSheet();
vectorCrossStyles.replaceSync(`
.vectorA { color: var(--line-red); }
.vectorB { color: var(--line-green); }
.vectorCross { color: var(--line-blue); }
.par { color: var(--line-yellow); }
.polygon {
    fill-opacity: 0.1;
    stroke-opacity: 0.4;
}
.vector-info.a {
    color: var(--info-red-primary);
    background: var(--info-red-secondary);
}
.vector-info.b {
    color: var(--info-green-primary);
    background: var(--info-green-secondary);
}
.vector-info.cross {
    color: var(--info-blue-primary);
    background: var(--info-blue-secondary);
}
`);
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
        this.attachShadow({ mode: "open" }).adoptedStyleSheets = [baseStyles, vectorCrossStyles];
    }

    connectedCallback() {
        const shadow = this.shadowRoot;
        const vectorStrokeWidth = 0.15;

        // Create wrapping div
        const div = document.createElement("div");
        div.classList.add("wrapper");
        shadow.appendChild(div);

        // Create SVG canvas
        const svg = createSVGElement("svg", {
            "viewBox": `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`,
        });

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

        // Create points for vectors (unconventionally: tail and head)
        const projA = project3DToIsometric(this.v1.x, this.v1.y, 0);
        const projB = project3DToIsometric(this.v2.x, this.v2.y, 0);

        const p00 = new Point("p00", 0, 0);
        const pA = new Point("pA", projA.x, projA.y);
        const pB = new Point("pB", projB.x, projB.y);

        // Cross product vector
        const axb = this.v1.x * this.v2.y - this.v1.y * this.v2.x;
        // NOTE: Need to flip the Y because of the nature of SVG canvas (also scaling for visuals)
        const projCross = project3DToIsometric(0, 0, -axb * 0.2);
        const pCross = new Point("cross", projCross.x, projCross.y);

        // Define the parallelogram's point that A and B encompass
        const asumb = project3DToIsometric(this.pp.x, this.pp.y, 0);
        const pTip = new Point("ptip", asumb.x, asumb.y);

        // Draw the parallelogram
        new Polygon({
            points: [p00, pB, pTip, pA],
            parent: svg,
            key: "par",
            label: {
                text: "|AxB|",
                flipY: true,
            },
            stroke: {
                width: 0.05,
            }
        });

        const vectorA = new Vector({
            start: p00,
            end: pA,
            label: {
                text: "A",
                offset: -0.6,
                flipY: true
            },
            parent: svg,
            key: "vectorA",
            stroke: {
                width: vectorStrokeWidth,
            },
        });

        const vectorB = new Vector({
            start: p00,
            end: pB,
            label: {
                text: "B",
                offset: 0.6,
                flipY: true
            },
            parent: svg,
            key: "vectorB",
            stroke: {
                width: vectorStrokeWidth,
            },
        });

        new Vector({
            start: p00,
            end: pCross,
            label: {
                text: "AxB",
                offset: 0.8,
                flipY: true
            },
            parent: svg,
            key: "vectorCross",
            stroke: {
                width: vectorStrokeWidth,
            },
        });

        // Add handles
        new Handle({
            point: pA,
            radius: 1.2,
            interactive: true,
            parent: svg
        });
        new Handle({
            point: pB,
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
            <div class="vector-info cross">A x B: <span id="info-cross">${-vectorCross(pA, pB).toFixed(1)}</span></div>
        `;
        const infoA = info.querySelector("#info-a");
        const infoB = info.querySelector("#info-b");
        const infoCross = info.querySelector("#info-cross");
        div.appendChild(info);

        pA.onChange(() => {
            // Update the parallelogram's tip
            const s = { x: pA.x + pB.x, y: pA.y + pB.y };
            pTip.set(s.x, s.y);

            const stoi1 = screenToIsometric(pA.x, pA.y);
            const stoi2 = screenToIsometric(pB.x, pB.y);

            // Recalculate cross product and update vector
            const c = vectorCross(stoi1, stoi2);
            const pc = project3DToIsometric(0, 0, -c * 0.2);
            pCross.set(pc.x, pc.y);

            infoA.textContent = `(${pA.x.toFixed(1)}, ${pA.y.toFixed(1)})`;
            infoCross.textContent = -c.toFixed(1);
        });

        pB.onChange(() => {
            // Update the parallelogram's tip
            const s = { x: pA.x + pB.x, y: pA.y + pB.y };
            pTip.set(s.x, s.y);

            const stoi1 = screenToIsometric(pA.x, pA.y);
            const stoi2 = screenToIsometric(pB.x, pB.y);

            // Recalculate cross product and update vector
            const c = vectorCross(stoi1, stoi2);
            const pc = project3DToIsometric(0, 0, -c * 0.2);
            pCross.set(pc.x, pc.y);

            infoB.textContent = `(${pB.x.toFixed(1)}, ${pB.y.toFixed(1)})`;
            infoCross.textContent = -c.toFixed(1);
        });
    }
}

const vectorRStyles = new CSSStyleSheet();
vectorRStyles.replaceSync(`
.V { color: var(--line-red); }
.R { color: var(--line-green); }
.surface, .normal { color: var(--line-yellow); }
.vector-info.v {
    color: var(--info-red-primary);
    background: var(--info-red-secondary);
}
.vector-info.r {
    color: var(--info-green-primary);
    background: var(--info-green-secondary);
}
`);
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
        this.attachShadow({ mode: "open" }).adoptedStyleSheets = [baseStyles, vectorRStyles];
    }

    connectedCallback() {
        const shadow = this.shadowRoot;
        const vectorStrokeWidth = 0.15;

        // Create wrapping div
        const div = document.createElement("div");
        div.classList.add("wrapper");
        shadow.appendChild(div);

        // Create SVG canvas
        const svg = createSVGElement("svg", {
            "viewBox": `${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`,
        });

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

        new Vector({
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
            },
            marker: false
        });

        new Vector({
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
            },
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
            },
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
            },
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
        const infoV = info.querySelector("#info-v");
        const infoR = info.querySelector("#info-r");
        div.appendChild(info);

        Vtail.onChange(() => {
            const v = vectorSubtract(p00, Vtail);
            const reflect = vectorReflect(v, n);

            Rhead.set(reflect.x, reflect.y);
            infoV.textContent = `(${Vtail.x.toFixed(1)}, ${Vtail.y.toFixed(1)})`;
            infoR.textContent = `(${reflect.x.toFixed(1)}, ${reflect.y.toFixed(1)})`;
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
            infoR.textContent = `(${reflect.x.toFixed(1)}, ${reflect.y.toFixed(1)})`;
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
