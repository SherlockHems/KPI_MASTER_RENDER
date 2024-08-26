import React, { useState, useEffect } from 'react';
import { Table, Card, Row, Col, Spin, message } from 'antd';
import { PieChart, Pie, Cell, ResponsiveContainer, Treemap, Tooltip, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];
const API_URL = process.env.REACT_APP_API_URL || 'https://your-backend-url.onrender.com';

const Clients = ({ searchTerm }) => {
  const [clientsData, setClientsData] = useState([]);
  const [provinceData, setProvinceData] = useState([]);
  const [clientListData, setClientListData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientsData();
    fetchProvinceData();
    fetchClientListData();
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
      message.error('获取客户数据失败。请稍后再试。');
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
      message.error('获取省份数据失败。请稍后再试。');
    }
  };

  const fetchClientListData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/client_list`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Fetched client list data:", data);
      const clientMap = data.reduce((acc, client) => {
        acc[client.CLIENT_NAME] = {
          phoneNumber: client.PHONE_NUMBER,
          province: client.PROVINCE
        };
        return acc;
      }, {});
      setClientListData(clientMap);
    } catch (error) {
      console.error('Error fetching client list data:', error);
      message.error('获取客户列表数据失败。请稍后再试。');
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
      phoneNumber: clientListData[client.name]?.phoneNumber || '未提供',
      province: clientListData[client.name]?.province || '未知'
    }))
  ).sort((a, b) => b.value - a.value);

  const formatValue = (value) => `¥${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const summaryColumns = [
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '累计收入贡献',
      dataIndex: 'value',
      key: 'value',
      render: (value) => formatValue(value),
      sorter: (a, b) => b.value - a.value,
      defaultSortOrder: 'descend',
    },
    {
      title: '销售人员',
      dataIndex: 'salesPerson',
      key: 'salesPerson',
    },
    {
      title: '电话号码',
      dataIndex: 'phoneNumber',
      key: 'phoneNumber',
    },
    {
      title: '省份',
      dataIndex: 'province',
      key: 'province',
    },
  ];

  const detailColumns = [
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '价值',
      dataIndex: 'value',
      key: 'value',
      render: (value) => formatValue(value),
      sorter: (a, b) => b.value - a.value,
      defaultSortOrder: 'descend',
    },
  ];

  if (loading) return <Spin size="large" />;
  if (clientsData.length === 0) return <div>暂无客户数据。</div>;

  return (
    <div>
      <h1>客户省份分布</h1>
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

      <h1>客户覆盖总览</h1>
      <Table
        dataSource={allClientsData}
        columns={summaryColumns}
        pagination={{ pageSize: 15 }}
        scroll={{ y: 600, x: 1200 }}
      />

      <h1>按销售人员的客户覆盖</h1>
      {filteredData.length === 0 ? (
        <div>未找到匹配的客户。</div>
      ) : (
        filteredData.map((salesPerson) => (
          <Card key={salesPerson.name} title={`${salesPerson.name}的客户`} style={{ marginBottom: 20 }}>
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