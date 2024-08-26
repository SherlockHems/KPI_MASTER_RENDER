import React, { useState, useEffect } from 'react';
import { Table, Card, Spin, Alert, Row, Col } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const Funds = ({ searchTerm }) => {
  const [fundsData, setFundsData] = useState({ allFunds: [], topFundsBreakdown: [] });
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
      setError(`错误: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
  };

  const columns = [
    {
      title: '基金名称',
      dataIndex: 'name',
      key: 'name',
      filteredValue: [searchTerm],
      onFilter: (value, record) => record.name.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: '累计收入',
      dataIndex: 'income',
      key: 'income',
      render: (text) => formatCurrency(text),
      sorter: (a, b) => a.income - b.income,
    },
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'white', padding: '5px', border: '1px solid #ccc' }}>
          <p>{`${label}: ${formatCurrency(payload[0].value)}`}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) return <Spin size="large" />;
  if (error) return <Alert message="错误" description={error} type="error" showIcon />;

  return (
    <div>
      <h1>基金概览</h1>
      <Card title="基金收入表格">
        <Table
          dataSource={fundsData.allFunds}
          columns={columns}
          pagination={{ pageSize: 10 }}
          rowKey="name"
        />
      </Card>
      <Card title="基金收入贡献" style={{ marginTop: 16 }}>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={fundsData.allFunds.slice(0, 20)}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="income" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="前5个收入贡献产品的客户收入分布" style={{ marginTop: 16 }}>
        <Row gutter={[16, 16]}>
          {fundsData.topFundsBreakdown.map((fund, index) => (
            <Col xs={24} sm={24} md={12} lg={12} xl={8} key={fund.fund}>
              <Card title={`${index + 1}. ${fund.fund}`}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={fund.clientBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="income"
                      label={(entry) => entry.client}
                    >
                      {fund.clientBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                    />
                  </PieChart>
                </ResponsiveContainer>
                <ul style={{ marginTop: 10, paddingLeft: 20 }}>
                  {fund.clientBreakdown.map((client, clientIndex) => (
                    <li key={client.client} style={{ color: COLORS[clientIndex % COLORS.length] }}>
                      {`${client.client}: ${formatCurrency(client.income)}`}
                    </li>
                  ))}
                </ul>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

export default Funds;