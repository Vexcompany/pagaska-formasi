import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Circle, Text, Group, Line } from 'react-konva';
import Konva from 'konva';
import { Position, Performer, Formation, Project } from '../types';

interface StageComponentProps {
  performers: Performer[];
  currentFormation: Formation;
  onUpdatePosition: (performerId: string, pos: Position) => void;
  width: number;
  height: number;
  transitionDuration: number;
  stageRef: React.RefObject<any>;
  projectSettings: Project['settings'];
}

export const StageComponent: React.FC<StageComponentProps> = ({
  performers,
  currentFormation,
  onUpdatePosition,
  width: initialWidth,
  height: initialHeight,
  transitionDuration,
  stageRef,
  projectSettings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: initialWidth, height: initialHeight });
  const groupRefs = useRef<Record<string, Konva.Group>>({});

  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    updateSize();

    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;

  // Animate positions when currentFormation changes
  useEffect(() => {
    const easingMap: Record<string, any> = {
      'Linear': Konva.Easings.Linear,
      'EaseInOut': Konva.Easings.EaseInOut,
      'Bounce': Konva.Easings.BounceEaseInOut,
      'Elastic': Konva.Easings.ElasticEaseInOut,
      'Back': Konva.Easings.BackEaseInOut,
      'Strong': Konva.Easings.StrongEaseInOut,
    };

    const selectedEasing = easingMap[currentFormation?.positions ? (projectSettings?.easing || 'EaseInOut') : 'EaseInOut'] || Konva.Easings.EaseInOut;

    performers.forEach((performer) => {
      const group = groupRefs.current[performer.id];
      const targetPos = currentFormation?.positions?.[performer.id] || { x: width / 2, y: height / 2 };
      
      if (group) {
        group.to({
          x: targetPos.x,
          y: targetPos.y,
          duration: transitionDuration,
          easing: selectedEasing,
        });
      }
    });
  }, [currentFormation, width, height, performers, transitionDuration, projectSettings?.easing]);

  // Grid settings
  const gridSize = 50;
  const lines = [];
  for (let i = 0; i <= width / gridSize; i++) {
    lines.push(<Line key={`v-${i}`} points={[i * gridSize, 0, i * gridSize, height]} stroke="#2d2d2d" strokeWidth={1} />);
  }
  for (let i = 0; i <= height / gridSize; i++) {
    lines.push(<Line key={`h-${i}`} points={[0, i * gridSize, width, i * gridSize]} stroke="#2d2d2d" strokeWidth={1} />);
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl border border-white/5 relative">
      <Stage width={width} height={height} ref={stageRef}>
        <Layer>
          {/* Grid */}
          {lines}
          
          {/* Center Lines */}
          <Line points={[width / 2, 0, width / 2, height]} stroke="#444" strokeWidth={2} dash={[10, 5]} />
          <Line points={[0, height / 2, width, height / 2]} stroke="#444" strokeWidth={2} dash={[10, 5]} />
          
          {/* Performers */}
          {performers.map((performer) => {
            const pos = currentFormation?.positions?.[performer.id] || { x: width / 2, y: height / 2 };
            return (
              <Group
                key={performer.id}
                ref={(el) => {
                  if (el) groupRefs.current[performer.id] = el;
                }}
                x={pos.x}
                y={pos.y}
                draggable
                onDragEnd={(e) => {
                  onUpdatePosition(performer.id, {
                    x: e.target.x(),
                    y: e.target.y(),
                  });
                }}
              >
                <Circle
                  radius={15}
                  fill={performer.color}
                  stroke="white"
                  strokeWidth={2}
                  shadowBlur={10}
                  shadowColor="black"
                  shadowOpacity={0.3}
                />
                <Text
                  text={performer.name}
                  fontSize={12}
                  fill="white"
                  align="center"
                  width={60}
                  offsetX={30}
                  y={20}
                  fontStyle="bold"
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
      
      {/* Stage Labels */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/10 rounded-full text-[10px] uppercase tracking-widest text-white/50 font-mono pointer-events-none">
        Front / Audience
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/10 rounded-full text-[10px] uppercase tracking-widest text-white/50 font-mono pointer-events-none">
        Back
      </div>
    </div>
  );
};
