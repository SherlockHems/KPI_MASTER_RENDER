import React, { useState, useEffect } from 'react';
import { Table, Card, Row, Col } from 'antd';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const Clients = ({ searchTerm }) => {
  const [clientsData, setClientsData] = useState([]);

  useEffect(() => {
    fetchClientsData();
  }, []);

  const fetchClientsData = async () => {
    try {
      const response = await fetch('/api/clients');
      const data = await response.json();
      setClientsData(data);
    } catch (error) {
      console.error('Error fetching clients data:', error);
    }
  };

  const filteredData = clientsData.filter(salesPerson =>
    salesPerson.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    salesPerson.clients.some(client => client.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const columns = [
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

  return (
    <div>
      <h1>Clients Coverage</h1>
      {filteredData.map((salesPerson) => (
        <Card key={salesPerson.name} title={`${salesPerson.name}'s Clients`} style={{ marginBottom: 20 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Table
                dataSource={salesPerson.clients}
                columns={columns}
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
      ))}
    </div>
  );
};

export default Clients;