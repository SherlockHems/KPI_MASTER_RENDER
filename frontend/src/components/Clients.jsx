import React, { useState, useEffect } from 'react';
import { Table, Card, Row, Col, Spin, message } from 'antd';
import { ChoroplethMap } from '@ant-design/charts';

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
    {
      title: 'Province',
      dataIndex: 'province',
      key: 'province',
    },
  ];

  const getProvinceData = (clients) => {
    const provinceData = {};
    clients.forEach(client => {
      if (client.province) {
        provinceData[client.province] = (provinceData[client.province] || 0) + client.value;
      }
    });
    return Object.entries(provinceData).map(([name, value]) => ({ name, value }));
  };

  const overallProvinceData = getProvinceData(allClientsData);

  const config = {
    map: {
      type: 'china',
    },
    colorField: 'value',
    style: {
      fill: '#D9D9D9',
      stroke: '#ffffff',
      lineWidth: 1,
    },
    label: {
      visible: true,
      field: 'name',
      style: {
        fill: '#000',
        fontSize: 10,
        textAlign: 'center',
      },
    },
    tooltip: {
      fields: ['name', 'value'],
      formatter: (datum) => {
        return { name: datum.name, value: `¥${datum.value.toLocaleString()}` };
      },
    },
    legend: {
      position: 'bottom-right',
    },
    color: ['#BAE7FF', '#1890FF', '#0050B3'],
  };

  if (loading) return <Spin size="large" />;
  if (clientsData.length === 0) return <div>No client data available.</div>;

  return (
    <div>
      <h1>Overall Client Regional Coverage</h1>
      <ChoroplethMap {...config} data={overallProvinceData} />

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
                <ChoroplethMap {...config} data={getProvinceData(salesPerson.clients)} />
              </Col>
            </Row>
          </Card>
        ))
      )}
    </div>
  );
};

export default Clients;