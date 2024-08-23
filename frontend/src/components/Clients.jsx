import React, { useState, useEffect } from 'react';
import { Table, Card, Row, Col, Spin, message } from 'antd';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { ChoroplethMap } from '@ant-design/charts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
const API_URL = process.env.REACT_APP_API_URL || 'https://your-backend-url.onrender.com';

const Clients = ({ searchTerm }) => {
  const [clientsData, setClientsData] = useState([]);
  const [provinceData, setProvinceData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientsData();
    fetchProvinceData();
  }, []);

  const fetchClientsData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/clients`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched clients data:", data);
      setClientsData(data);
    } catch (error) {
      console.error('Error fetching clients data:', error);
      message.error('Failed to fetch clients data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProvinceData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/province_counts`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched province data:", data);
      const formattedData = Object.entries(data).map(([name, value]) => ({
        name,
        value,
      }));
      setProvinceData(formattedData);
    } catch (error) {
      console.error('Error fetching province data:', error);
      message.error('Failed to fetch province data. Please try again later.');
    }
  };

  const filteredData = clientsData.filter(salesPerson =>
    salesPerson.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    salesPerson.clients.some(client => client.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const allClientsData = clientsData.flatMap(salesPerson =>
    salesPerson.clients.map(client => ({
      ...client,
      salesPerson: salesPerson.name
    }))
  ).sort((a, b) => b.value - a.value);

  const summaryColumns = [
    {
      title: 'Client Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Cumulative Income Contribution',
      dataIndex: 'value',
      key: 'value',
      render: (value) => `¥${value.toLocaleString()}`,
      sorter: (a, b) => a.value - b.value,
    },
    {
      title: 'Sales Person',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
    },
  ];

  const detailColumns = [
    {
      title: 'Client Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (value) => `¥${value.toLocaleString()}`,
    },
  ];

  const config = {
    map: {
      type: 'china',
    },
    colorField: 'value',
    style: {
      height: 600,
      width: '100%',
    },
    tooltip: {
      visible: true,
      fields: ['name', 'value'],
    },
    legend: {
      position: 'bottom',
    },
    data: provinceData,
  };

  if (loading) return <Spin size="large" />;
  if (clientsData.length === 0) return <div>No client data available.</div>;

  return (
    <div>
      <h1>Client Distribution by Province</h1>
      <Card style={{ marginBottom: 20 }}>
        <ChoroplethMap {...config} />
      </Card>

      <h1>Clients Coverage Summary</h1>
      <Table
        dataSource={allClientsData}
        columns={summaryColumns}
        pagination={{ pageSize: 10 }}
        scroll={{ y: 400 }}
      />

      <h1>Clients Coverage by Sales Person</h1>
      {filteredData.length === 0 ? (
        <div>No matching clients found.</div>
      ) : (
        filteredData.map((salesPerson) => (
          <Card key={salesPerson.name} title={`${salesPerson.name}'s Clients`} style={{ marginBottom: 20 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Table
                  dataSource={salesPerson.clients}
                  columns={detailColumns}
                  pagination={{ pageSize: 5 }}
                  scroll={{ y: 240 }}
                />
              </Col>
              <Col span={6}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={salesPerson.clients}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {salesPerson.clients.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Col>
              <Col span={6}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={salesPerson.clients.slice(0, 5)}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </Col>
            </Row>
          </Card>
        ))
      )}
    </div>
  );
};

export default Clients;