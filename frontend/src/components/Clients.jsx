import React, { useState, useEffect } from 'react';
import { Table, Card, Row, Col, Spin, message } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = process.env.REACT_APP_API_URL || 'https://your-backend-url.onrender.com';

const Clients = ({ searchTerm }) => {
  const [clientsData, setClientsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientsData();
  }, []);

  const fetchClientsData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/clients`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched data:", data);
      setClientsData(data);
    } catch (error) {
      console.error('Error fetching clients data:', error);
      message.error('Failed to fetch clients data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = clientsData.filter(salesPerson =>
    salesPerson.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    salesPerson.clients.some(client => client.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const allClientsData = clientsData.flatMap(salesPerson =>
    salesPerson.clients.map(client => ({
      ...client,
      salesPerson: salesPerson.name,
      province: client.province || 'Unknown'  // Set default value for missing province
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
    {
      title: 'Province',
      dataIndex: 'province',
      key: 'province',
    },
  ];

  const getProvinceData = (clients) => {
    const provinceData = {};
    clients.forEach(client => {
      const province = client.province || 'Unknown';
      provinceData[province] = (provinceData[province] || 0) + (client.value || 0);
    });
    return Object.entries(provinceData)
      .map(([name, value]) => ({ province: name, value }))
      .filter(item => item.value > 0)  // Remove entries with zero or negative values
      .sort((a, b) => b.value - a.value);  // Sort by value in descending order
  };

  const overallProvinceData = getProvinceData(allClientsData);

  const renderChart = (data) => {
    if (data.length === 0) return <div>No data available for chart</div>;

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="province" />
          <YAxis />
          <Tooltip formatter={(value) => `¥${value.toLocaleString()}`} />
          <Legend />
          <Bar dataKey="value" fill="#8884d8" name="Income Contribution" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  if (loading) return <Spin size="large" />;
  if (clientsData.length === 0) return <div>No client data available.</div>;

  return (
    <div>
      <h1>Overall Client Regional Coverage</h1>
      {renderChart(overallProvinceData)}

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
                  columns={summaryColumns.filter(col => col.key !== 'salesPerson')}
                  pagination={{ pageSize: 5 }}
                  scroll={{ y: 240 }}
                />
              </Col>
              <Col span={12}>
                {renderChart(getProvinceData(salesPerson.clients))}
              </Col>
            </Row>
          </Card>
        ))
      )}
    </div>
  );
};

export default Clients;