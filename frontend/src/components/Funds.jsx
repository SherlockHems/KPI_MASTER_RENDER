import React, { useState, useEffect } from 'react';
import { Table, Card, Spin, Alert } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';

const Funds = ({ searchTerm }) => {
  const [fundsData, setFundsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFundsData();
  }, []);

  const fetchFundsData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/funds`);
      setFundsData(response.data);
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const columns = [
    {
      title: 'Fund Name',
      dataIndex: 'name',
      key: 'name',
      filteredValue: [searchTerm],
      onFilter: (value, record) => record.name.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: 'Cumulative Income',
      dataIndex: 'income',
      key: 'income',
      render: (text) => formatCurrency(text),
      sorter: (a, b) => a.income - b.income,
    },
  ];

  if (loading) return <Spin size="large" />;
  if (error) return <Alert message="Error" description={error} type="error" showIcon />;

  return (
    <div>
      <h1>Funds Overview</h1>
      <Card title="Funds Income Table">
        <Table
          dataSource={fundsData}
          columns={columns}
          pagination={{ pageSize: 10 }}
          rowKey="name"
        />
      </Card>
      <Card title="Funds Income Contribution" style={{ marginTop: 16 }}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={fundsData.slice(0, 20)} // Showing top 20 funds
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="income" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default Funds;