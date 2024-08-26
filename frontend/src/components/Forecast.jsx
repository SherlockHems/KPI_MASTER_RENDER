import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, Spin, Alert } from 'antd';
import axios from 'axios';

const Forecast = () => {
  const [forecastData, setForecastData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchForecastData();
  }, []);

  const fetchForecastData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/forecast`);
      setForecastData(response.data);
    } catch (e) {
      setError(`获取预测数据失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
  };

  if (loading) return <Spin size="large" />;
  if (error) return <Alert message="错误" description={error} type="error" showIcon />;

  return (
    <div>
      <h1>收入预测</h1>
      <Card>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
              label={{ value: '日期', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              tickFormatter={formatCurrency}
              label={{ value: '累计收入 (CNY)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              labelFormatter={(label) => new Date(label).toLocaleDateString('zh-CN')}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="cumulativeIncome"
              stroke="#8884d8"
              strokeWidth={2}
              dot={false}
              name="实际累计收入"
              strokeDasharray="0"
              data={forecastData.filter(d => d.isActual)}
            />
            <Line
              type="monotone"
              dataKey="cumulativeIncome"
              stroke="#82ca9d"
              strokeWidth={2}
              dot={false}
              name="预测累计收入"
              strokeDasharray="5 5"
              data={forecastData.filter(d => !d.isActual)}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default Forecast;