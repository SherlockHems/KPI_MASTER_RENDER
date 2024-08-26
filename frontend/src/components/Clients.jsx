import React, { useState, useEffect } from 'react';
import { Table, Card, Row, Col, Spin, message } from 'antd';
import { PieChart, Pie, Cell, ResponsiveContainer, Treemap, Tooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];
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

  const formatValue = (value) => `¥${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
      render: (value) => formatValue(value),
      sorter: (a, b) => b.value - a.value,
      defaultSortOrder: 'descend',
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
      render: (value) => formatValue(value),
      sorter: (a, b) => b.value - a.value,
      defaultSortOrder: 'descend',
    },
  ];

  if (loading) return <Spin size="large" />;
  if (clientsData.length === 0) return <div>No client data available.</div>;

  return (
    <div>
      <h1>Client Distribution by Province</h1>
      <Card style={{ marginBottom: 20 }}>
        <ResponsiveContainer width="100%" height={500}>
          <Treemap
            data={provinceData}
            dataKey="value"
            aspectRatio={4 / 3}
            stroke="#fff"
            fill="#8884d8"
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </Card>

      <h1>Clients Coverage Summary</h1>
      <Table
        dataSource={allClientsData}
        columns={summaryColumns}
        pagination={{ pageSize: 15 }}
        scroll={{ y: 600 }}
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
                  pagination={{ pageSize: 15 }}
                  scroll={{ y: 600 }}
                />
              </Col>
              <Col span={12}>
                <ResponsiveContainer width="100%" height={600}>
                  <PieChart>
                    <Pie
                      data={salesPerson.clients}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={200}
                      fill="#8884d8"
                      dataKey="value"
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(2)}%`}
                    >
                      {salesPerson.clients.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatValue(value)} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" />
                  </PieChart>
                </ResponsiveContainer>
              </Col>
            </Row>
          </Card>
        ))
      )}
    </div>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: '#fff', padding: '5px', border: '1px solid #ccc' }}>
        <p>{`${payload[0].payload.name} : ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

export default Clients;