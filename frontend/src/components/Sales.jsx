import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, Row, Col, Spin, Alert, Select, Table, Radio } from 'antd';
import axios from 'axios';

const { Option } = Select;

function Sales({ searchTerm }) {
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState(null);
  const [contributionType, setContributionType] = useState('cumulative');

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/sales`);
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      setSalesData(response.data);
      if (response.data.salesPersons.length > 0) {
        setSelectedSalesPerson(response.data.salesPersons[0].name);
      }
    } catch (e) {
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spin size="large" />;
  if (error) return <Alert message="Error" description={error} type="error" showIcon />;
  if (!salesData || salesData.salesPersons.length === 0) return <Alert message="No sales data available" type="warning" showIcon />;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

  const salesPersonColumns = [
    {
      title: 'Sales Person',
      dataIndex: 'name',
      key: 'name',
      filteredValue: [searchTerm],
      onFilter: (value, record) => record.name.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: 'Total Income',
      dataIndex: 'totalIncome',
      key: 'totalIncome',
      render: (text) => formatCurrency(text),
      sorter: (a, b) => a.totalIncome - b.totalIncome,
    },
    {
      title: 'Total Clients',
      dataIndex: 'totalClients',
      key: 'totalClients',
      sorter: (a, b) => a.totalClients - b.totalClients,
    }
  ];

  const cumulativeData = salesData.dailyContribution.reduce((acc, day) => {
    const prevDay = acc[acc.length - 1] || {};
    const newDay = { date: day.date };
    salesData.salesPersons.forEach(person => {
      newDay[person.name] = (prevDay[person.name] || 0) + (day[person.name] || 0);
    });
    acc.push(newDay);
    return acc;
  }, []);

  const renderTooltipContent = (data) => {
    if (!data.payload || data.payload.length === 0) return null;
    const salesPerson = selectedSalesPerson;
    const topClients = salesData.individualPerformance[salesPerson].topClients;

    return (
      <div style={{ backgroundColor: 'white', padding: '10px', border: '1px solid #ccc' }}>
        <p>{`Date: ${new Date(data.label).toLocaleDateString()}`}</p>
        <p>{`Income: ${formatCurrency(data.payload[0].value)}`}</p>
        <p>Top Clients:</p>
        <ul>
          {topClients.map((client, index) => (
            <li key={index}>{`${client[0]}: ${formatCurrency(client[1])}`}</li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div>
      <h1>Sales Dashboard</h1>

      <Row gutter={16}>
        <Col span={24}>
          <Card title="Cumulative Income Contribution by Sales Person">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={salesData.salesPersons}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="totalIncome" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card title="Sales Person Performance" style={{ marginTop: 16 }}>
        <Table
          dataSource={salesData.salesPersons}
          columns={salesPersonColumns}
          pagination={false}
        />
      </Card>

      <Card title="All Sales Persons Income Contribution" style={{ marginTop: 16 }}>
        <Radio.Group
          value={contributionType}
          onChange={(e) => setContributionType(e.target.value)}
          style={{ marginBottom: 16 }}
        >
          <Radio.Button value="cumulative">Cumulative</Radio.Button>
          <Radio.Button value="daily">Daily</Radio.Button>
        </Radio.Group>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={contributionType === 'cumulative' ? cumulativeData : salesData.dailyContribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <YAxis tickFormatter={formatCurrency} />
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
            />
            <Legend />
            {salesData.salesPersons.map((person, index) => (
              <Line
                key={person.name}
                type="monotone"
                dataKey={person.name}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={contributionType === 'daily' ? { stroke: colors[index % colors.length], strokeWidth: 2, r: 4 } : false}
                activeDot={{ r: 8 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Individual Sales Person Performance" style={{ marginTop: 16 }}>
        <Select
          style={{ width: 200, marginBottom: 16 }}
          value={selectedSalesPerson}
          onChange={setSelectedSalesPerson}
        >
          {salesData.salesPersons.map(person => (
            <Option key={person.name} value={person.name}>{person.name}</Option>
          ))}
        </Select>
        <Row gutter={16}>
          <Col span={12}>
            <h3>Income Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={salesData.individualPerformance[selectedSalesPerson].dailyIncome}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip content={renderTooltipContent} />
                <Area type="monotone" dataKey="income" stroke="#8884d8" fill="#8884d8" />
              </AreaChart>
            </ResponsiveContainer>
          </Col>
          <Col span={12}>
            <h3>Client Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesData.individualPerformance[selectedSalesPerson].topClients}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="0" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="1" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </Col>
        </Row>
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <h3>Fund Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesData.individualPerformance[selectedSalesPerson].topFunds}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="0" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="1" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </Col>
          <Col span={12}>
            <h3>Daily Income</h3>
            <Table
              dataSource={salesData.individualPerformance[selectedSalesPerson].dailyIncome}
              columns={[
                {
                  title: 'Date',
                  dataIndex: 'date',
                  key: 'date',
                  render: (text) => new Date(text).toLocaleDateString()
                },
                {
                  title: 'Income',
                  dataIndex: 'income',
                  key: 'income',
                  render: (text) => formatCurrency(text)
                }
              ]}
              pagination={{ pageSize: 10 }}
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default Sales;