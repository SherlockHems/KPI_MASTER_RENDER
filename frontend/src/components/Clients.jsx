import React, { useState, useEffect } from 'react';
import { Table, Card, Row, Col, Spin } from 'antd';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import axios from 'axios';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const Clients = ({ searchTerm }) => {
  const [clientsData, setClientsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClientsData = async () => {
      try {
        const response = await axios.get('/api/clients');
        setClientsData(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching clients data:', error);
        setLoading(false);
      }
    };

    fetchClientsData();
  }, []);

  if (loading) {
    return <Spin size="large" />;
  }

  if (!clientsData) {
    return <div>No client data available</div>;
  }

  const filteredData = clientsData.filter(salesperson =>
    salesperson.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    salesperson.clients.some(client => client.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const columns = [
    {
      title: 'Sales Person',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Number of Clients',
      dataIndex: 'clientCount',
      key: 'clientCount',
      sorter: (a, b) => a.clientCount - b.clientCount,
    },
    {
      title: 'Total Client Value',
      dataIndex: 'totalClientValue',
      key: 'totalClientValue',
      sorter: (a, b) => a.totalClientValue - b.totalClientValue,
      render: (value) => `¥${value.toLocaleString()}`,
    },
  ];

  const ClientPieChart = ({ data }) => (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );

  const ClientBarChart = ({ data }) => (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="clientCount" fill="#8884d8" name="Number of Clients" />
        <Bar dataKey="totalClientValue" fill="#82ca9d" name="Total Client Value" />
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div>
      <h1>Client Coverage</h1>
      <Table dataSource={filteredData} columns={columns} rowKey="name" />
      <Row gutter={16}>
        <Col span={12}>
          <Card title="Client Distribution">
            <ClientPieChart data={filteredData.map(d => ({ name: d.name, value: d.clientCount }))} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Client Value Distribution">
            <ClientPieChart data={filteredData.map(d => ({ name: d.name, value: d.totalClientValue }))} />
          </Card>
        </Col>
      </Row>
      <Card title="Sales Person Performance" style={{ marginTop: '20px' }}>
        <ClientBarChart data={filteredData} />
      </Card>
    </div>
  );
};

export default Clients;