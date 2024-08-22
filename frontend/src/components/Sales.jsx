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
      console.log("Sales API response:", response.data);

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const processedData = processData(response.data.sales_income);
      setSalesData(processedData);
      if (processedData.salesPersons.length > 0) {
        setSelectedSalesPerson(processedData.salesPersons[0].name);
      }
    } catch (e) {
      console.error("Error fetching sales data:", e);
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const processData = (rawData) => {
    console.log("Raw data received:", rawData);

    if (!rawData || Object.keys(rawData).length === 0) {
      console.error("Invalid or empty sales data received");
      return { salesPersons: [], dailyContribution: [], individualPerformance: {} };
    }

    const salesPersons = Object.keys(Object.values(rawData)[0] || {});

    const salesPersonsData = salesPersons.map(person => ({
      name: person,
      cumulativeIncome: Object.values(rawData).reduce((sum, day) => sum + (day[person] || 0), 0),
      totalClients: new Set(Object.values(rawData).flatMap(day =>
        Object.keys(day[person] || {})
      )).size
    }));

    const dailyContribution = Object.entries(rawData).map(([date, incomes]) => ({
      date,
      ...incomes
    }));

    const individualPerformance = {};
    salesPersons.forEach(person => {
      individualPerformance[person] = {
        daily: Object.entries(rawData).map(([date, incomes]) => ({
          date,
          income: incomes[person] || 0
        })),
        clients: {},
        funds: {}
      };

      Object.entries(rawData).forEach(([date, incomes]) => {
        if (incomes[person]) {
          Object.entries(incomes[person]).forEach(([client, clientData]) => {
            if (!individualPerformance[person].clients[client]) {
              individualPerformance[person].clients[client] = [];
            }
            individualPerformance[person].clients[client].push({ date, income: clientData.total });

            Object.entries(clientData.funds).forEach(([fund, income]) => {
              if (!individualPerformance[person].funds[fund]) {
                individualPerformance[person].funds[fund] = [];
              }
              individualPerformance[person].funds[fund].push({ date, income });
            });
          });
        }
      });
    });

    return {
      salesPersons: salesPersonsData,
      dailyContribution,
      individualPerformance
    };
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
      dataIndex: 'cumulativeIncome',
      key: 'cumulativeIncome',
      render: (text) => formatCurrency(text),
      sorter: (a, b) => a.cumulativeIncome - b.cumulativeIncome,
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

  const selectedPersonData = salesData.individualPerformance[selectedSalesPerson];

  const clientBreakdownData = Object.entries(selectedPersonData.clients).map(([client, data]) => ({
    name: client,
    income: data.reduce((sum, day) => sum + day.income, 0)
  })).sort((a, b) => b.income - a.income).slice(0, 10);

  const fundBreakdownData = Object.entries(selectedPersonData.funds).map(([fund, data]) => ({
    name: fund,
    income: data.reduce((sum, day) => sum + day.income, 0)
  })).sort((a, b) => b.income - a.income).slice(0, 10);

  const dailyIncomeColumns = [
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
  ];

  return (
    <div>
      <h1>Sales Dashboard</h1>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Cumulative Income Contribution by Sales Person">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={salesData.salesPersons}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="cumulativeIncome" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Sales Person Performance">
            <Table
              dataSource={salesData.salesPersons}
              columns={salesPersonColumns}
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

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
          <Col span={8}>
            <Card title="Daily Income">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={selectedPersonData.daily}>
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
                  <Area type="monotone" dataKey="income" stroke="#8884d8" fill="#8884d8" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col span={8}>
            <Card title="Top 10 Clients">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={clientBreakdownData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={formatCurrency} />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="income" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col span={8}>
            <Card title="Top 10 Funds">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={fundBreakdownData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={formatCurrency} />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="income" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
        <Card title="Daily Income Table" style={{ marginTop: 16 }}>
          <Table
            dataSource={selectedPersonData.daily}
            columns={dailyIncomeColumns}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </Card>
    </div>
  );
}

export default Sales;