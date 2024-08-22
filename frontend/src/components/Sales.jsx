import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, Spin, Alert } from 'antd';
import axios from 'axios';

function Sales() {
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/sales`);
      console.log("Sales API response:", response.data);

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const processedData = processData(response.data);
      setSalesData(processedData);
    } catch (e) {
      console.error("Error fetching sales data:", e);
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const processData = (rawData) => {
    console.log("Raw data received:", rawData);

    if (!rawData || !rawData.sales_income || Object.keys(rawData.sales_income).length === 0) {
      console.error("Invalid or empty sales data received");
      return [];
    }

    const salesPersons = Object.keys(rawData.sales_income[Object.keys(rawData.sales_income)[0]] || {});

    return salesPersons.map(person => ({
      name: person,
      income: Object.values(rawData.sales_income).reduce((sum, day) => sum + (day[person] || 0), 0)
    }));
  };

  if (loading) return <Spin size="large" />;
  if (error) return <Alert message="Error" description={error} type="error" showIcon />;
  if (!salesData || salesData.length === 0) return <Alert message="No sales data available" type="warning" showIcon />;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  return (
    <div>
      <h1>Sales Dashboard</h1>
      <Card title="Income Contribution by Sales Person">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={salesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Bar dataKey="income" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

export default Sales;