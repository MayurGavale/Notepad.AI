import { useState, useRef, useEffect } from 'react';
import { SWATCHES } from '../../constants';
import { ColorSwatch, Group, Button, Slider} from '@mantine/core';


import axios from 'axios';
import Draggable from 'react-draggable';
import { Eraser, Play, RotateCcw } from 'lucide-react';

// import {LazyBrush} from 'lazy-brush';

interface GeneratedResult {
    expression: string;
    answer: string;
}

interface Response {
    expr: string;
    result: string;
    assign: boolean;
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('rgb(255, 255, 255)');
    const [reset, setReset] = useState(false);
    const [dictOfVars, setDictOfVars] = useState({});
    const [result, setResult] = useState<GeneratedResult>();
    const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
    const [latexExpression, setLatexExpression] = useState<Array<string>>([]);
    const [isEraser, setIsEraser] = useState(false);
    const [brushSize, setBrushSize] = useState(3);
    const [showSizeSlider, setShowSizeSlider] = useState(false);


    // const lazyBrush = new LazyBrush({
    //     radius: 10,
    //     enabled: true,
    //     initialPoint: { x: 0, y: 0 },
    // });

    useEffect(() => {
        if (latexExpression.length > 0 && window.MathJax) {
            setTimeout(() => {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
            }, 0);
        }
    }, [latexExpression]);

    useEffect(() => {
        if (result) {
            renderLatexToCanvas(result.expression, result.answer);
        }
    }, [result]);

    useEffect(() => {
        if (reset) {
            resetCanvas();
            setLatexExpression([]);
            setResult(undefined);
            setDictOfVars({});
            setReset(false);
        }
    }, [reset]);

    useEffect(() => {
        const canvas = canvasRef.current;
    
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight - canvas.offsetTop;
                ctx.lineCap = 'round';
                ctx.lineWidth = 3;
            }

        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML';
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            window.MathJax.Hub.Config({
                tex2jax: {inlineMath: [['$', '$'], ['\\(', '\\)']]},
            });
        };

        return () => {
            document.head.removeChild(script);
        };

    }, []);

    const renderLatexToCanvas = (expression: string, answer: string) => {
        const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
        setLatexExpression([...latexExpression, latex]);

        // Clear the main canvas
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };


    const resetCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.background = 'black';
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                ctx.lineWidth = brushSize;
                if (isEraser) {
                    ctx.globalCompositeOperation = 'destination-out';
                } else {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.strokeStyle = color;
                }
                setIsDrawing(true);
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                ctx.stroke();
            }
        }
    };

    const toggleEraser = () => {
        setIsEraser(!isEraser);
        if (isEraser) {
            setColor(color); // Restore previous color when disabling eraser
        }
    };
    const stopDrawing = () => {
        setIsDrawing(false);
    };  

    const runRoute = async () => {
        const canvas = canvasRef.current;
    
        if (canvas) {
            const response = await axios({
                method: 'post',
                url: `${import.meta.env.VITE_API_URL}/calculate`,
                data: {
                    image: canvas.toDataURL('image/png'),
                    dict_of_vars: dictOfVars
                }
            });

            const resp = await response.data;
            console.log('Response', resp);
            resp.data.forEach((data: Response) => {
                if (data.assign === true) {
                    // dict_of_vars[resp.result] = resp.answer;
                    setDictOfVars({
                        ...dictOfVars,
                        [data.expr]: data.result
                    });
                }
            });
            const ctx = canvas.getContext('2d');
            const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
            let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const i = (y * canvas.width + x) * 4;
                    if (imageData.data[i + 3] > 0) {  // If pixel is not transparent
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            setLatexPosition({ x: centerX, y: centerY });
            resp.data.forEach((data: Response) => {
                setTimeout(() => {
                    setResult({
                        expression: data.expr,
                        answer: data.result
                    });
                }, 1000);
            });
        }
    };

    return (
        <div className="relative min-h-screen bg-gray-900">
            {/* Top Control Panel */}
            <div className="fixed top-0 left-0 right-0 bg-gray-800/90 backdrop-blur-sm shadow-lg z-30">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                        {/* Left Section - Action Buttons */}
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={() => setReset(true)}
                                className="w-20 bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 transition-colors"
                                variant="default"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset
                            </Button>
                            <Button
                                onClick={runRoute}
                                className="w-20 bg-green-500 hover:bg-green-600 text-white flex items-center gap-2 transition-colors"
                                variant="default"
                            >
                                <Play className="w-4 h-4" />
                                Run
                            </Button>
                            <Button
                                onClick={toggleEraser}
                                className={`w-20 flex items-center gap-2 transition-colors ${
                                    isEraser 
                                        ? 'bg-blue-500 hover:bg-blue-600' 
                                        : 'bg-gray-600 hover:bg-gray-700'
                                } text-white`}
                                variant="default"
                            >
                                <Eraser className="w-4 h-4" />
                                Eraser
                            </Button>
                            <div className="relative">
                                <Button
                                    onClick={() => setShowSizeSlider(!showSizeSlider)}
                                    className="w-24 bg-gray-600 hover:bg-gray-700 text-white transition-colors"
                                    variant="default"
                                >
                                    Size: {brushSize}
                                </Button>
                                {showSizeSlider && (
                                    <div className="absolute top-12 left-0 w-48 bg-gray-800 p-4 rounded-lg shadow-lg">
                                        <Slider
                                            value={brushSize}
                                            onChange={setBrushSize}
                                            min={1}
                                            max={20}
                                            label={(value) => `${value}px`}
                                            className="mt-2"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Center Section - Color Swatches */}
                        <div className="flex-1 flex justify-center">
                            <div className="bg-gray-700/50 rounded-lg p-2">
                                <Group className="flex justify-center">
                                    {SWATCHES.map((swatch) => (
                                        <div
                                            key={swatch}
                                            className="relative group"
                                        >
                                            <ColorSwatch
                                                color={swatch}
                                                onClick={() => {
                                                    setColor(swatch);
                                                    setIsEraser(false);
                                                }}
                                                className={`w-8 h-8 cursor-pointer transition-transform hover:scale-110 ${
                                                    color === swatch && !isEraser ? 'ring-2 ring-white' : ''
                                                }`}
                                            />
                                            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 
                                                           opacity-0 group-hover:opacity-100 transition-opacity
                                                           bg-gray-900 text-white text-xs px-2 py-1 rounded">
                                                {swatch === 'rgb(255, 255, 255)' ? 'White' : 
                                                 swatch === 'rgb(0, 0, 0)' ? 'Black' : swatch}
                                            </div>
                                        </div>
                                    ))}
                                </Group>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Canvas and Latex Expressions (keep the same) */}
            <canvas
                ref={canvasRef}
                id="canvas"
                className="absolute top-16 left-0 w-full h-[calc(100vh-4rem)]"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
            />

            {latexExpression && latexExpression.map((latex, index) => (
                <Draggable
                    key={index}
                    defaultPosition={latexPosition}
                    onStop={(_e, data) => setLatexPosition({ x: data.x, y: data.y })}
                >
                    <div className="absolute p-3 bg-gray-800/90 backdrop-blur-sm text-white rounded-lg shadow-lg">
                        <div className="latex-content text-lg">{latex}</div>
                    </div>
                </Draggable>
            ))}
        </div>
    );
}