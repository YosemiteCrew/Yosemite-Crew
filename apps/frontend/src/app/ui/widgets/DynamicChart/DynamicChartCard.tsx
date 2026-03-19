'use client';
import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { LayoutType } from 'recharts/types/util/types';

type ChartProps = {
  data: any[];
  type?: 'bar' | 'line';
  keys: { name: string; color: string }[];
  yTickFormatter?: (value: number) => string;
  yAxisWidth?: number;
  layout?: LayoutType;
  barSize?: number;
  hideKeys?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
};

type TiltedTickProps = { x: number; y: number; payload: { value: string } };

const TiltedYTick = ({ x, y, payload }: TiltedTickProps) => (
  <g transform={`translate(${x},${y})`}>
    <text x={0} y={0} dx={-4} textAnchor="end" fontSize={11} fill="#666" transform="rotate(-30)">
      {payload.value}
    </text>
  </g>
);

const DynamicChartCard: React.FC<ChartProps> = ({
  data,
  type = 'bar',
  keys,
  yTickFormatter,
  yAxisWidth,
  layout,
  barSize,
  hideKeys = false,
  xAxisLabel,
  yAxisLabel,
}) => {
  const isVerticalLayout = layout === 'vertical';
  const chartMargin = {
    top: 0,
    right: isVerticalLayout ? 8 : 0,
    left: yAxisLabel ? 20 : 0,
    bottom: xAxisLabel ? 26 : 0,
  };

  return (
    <div className="bg-white border border-card-border p-3 flex flex-col gap-2 rounded-2xl">
      {!hideKeys && (
        <div className="flex items-center justify-center w-full gap-6">
          {keys.map((key) => (
            <span key={key.name} className="flex items-center gap-1.5">
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: key.color,
                  borderRadius: '50%',
                  display: 'inline-block',
                }}
              />
              <span className="text-capton-1 text-text-primary">{key.name}</span>
            </span>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={300}>
        {type === 'line' ? (
          <LineChart data={data} margin={chartMargin}>
            <XAxis
              dataKey="month"
              label={
                xAxisLabel
                  ? { value: xAxisLabel, position: 'insideBottom', offset: -2, dy: 16 }
                  : undefined
              }
            />
            <YAxis
              tickFormatter={yTickFormatter}
              label={
                yAxisLabel
                  ? { value: yAxisLabel, angle: -90, position: 'insideLeft', offset: 4, dx: -16 }
                  : undefined
              }
            />
            <Tooltip />
            {keys.map((key) => (
              <Line
                key={key.name}
                type="monotone"
                dataKey={key.name}
                stroke={key.color}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart
            data={data}
            layout={layout}
            style={{ height: '100%', maxHeight: '100%', width: '100%', maxWidth: '100%' }}
            margin={chartMargin}
          >
            <CartesianGrid strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey={isVerticalLayout ? undefined : 'month'}
              type={isVerticalLayout ? 'number' : 'category'}
              tick={{ fontSize: 11 }}
              interval={0}
              label={
                xAxisLabel
                  ? { value: xAxisLabel, position: 'insideBottom', offset: -2, dy: 16 }
                  : undefined
              }
            />
            <YAxis
              dataKey={isVerticalLayout ? 'month' : undefined}
              type={isVerticalLayout ? 'category' : 'number'}
              tickFormatter={isVerticalLayout ? undefined : yTickFormatter}
              width={isVerticalLayout ? 100 : yAxisWidth}
              tick={isVerticalLayout ? TiltedYTick : { fontSize: 11 }}
              label={
                !isVerticalLayout && yAxisLabel
                  ? { value: yAxisLabel, angle: -90, position: 'insideLeft', offset: 0, dx: -12 }
                  : undefined
              }
            />
            <Tooltip />
            {keys.map((key) => (
              <Bar
                key={key.name}
                dataKey={key.name}
                fill={key.color}
                stackId="a"
                barSize={barSize}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default DynamicChartCard;
