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
      setError(`Failed to fetch forecast data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'CNY' }).format(value);
  };

  if (loading) return <Spin size="large" />;
  if (error) return <Alert message="Error" description={error} type="error" showIcon />;

  return (
    <div>
      <h1>Income Forecast</h1>
      <Card>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Line
              type="monotone"
              dataKey="cumulativeIncome"
              stroke="#8884d8"
              strokeWidth={2}
              dot={false}
              name="Cumulative Income"
              strokeDasharray={(datum) => datum.isActual ? "0" : "5 5"}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default Forecast;