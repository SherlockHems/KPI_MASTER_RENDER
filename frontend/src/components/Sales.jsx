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

      // Add total clients count to each sales person
      const updatedSalesPersons = response.data.salesPersons.map(person => ({
        ...person,
        totalClients: person.topClients.length // Assuming topClients contains all clients
      }));

      setSalesData({
        ...response.data,
        salesPersons: updatedSalesPersons
      });

      if (updatedSalesPersons.length > 0) {
        setSelectedSalesPerson(updatedSalesPersons[0].name);
      }
    } catch (e) {
      console.error("Error fetching sales data:", e);
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
      title: 'Total Clients',
      dataIndex: 'totalClients',
      key: 'totalClients',
      sorter: (a, b) => a.totalClients - b.totalClients,
    },
    {
      title: 'Total Income',
      dataIndex: 'cumulativeIncome',
      key: 'cumulativeIncome',
      render: (text) => formatCurrency(text),
      sorter: (a, b) => a.cumulativeIncome - b.cumulativeIncome,
    }
  ];

  const cumulativeData = salesData.dailyContribution.reduce((acc, day) => {
    const prevDay = acc[acc.length - 1] || {};
    const newDay = { date: day.date };
    Object.keys(day).forEach(key => {
      if (key !== 'date') {
        newDay[key] = (prevDay[key] || 0) + day[key];
      }
    });
    acc.push(newDay);
    return acc;
  }, []);

  const prepareIndividualData = (data, dataKey) => {
    return data.map(day => {
      const sortedEntries = Object.entries(day[dataKey])
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      return {
        date: day.date,
        ...Object.fromEntries(sortedEntries)
      };
    });
  };

  const renderBreakdownChart = (data, dataKey) => {
    const allKeys = new Set(data.flatMap(day => Object.keys(day).filter(key => key !== 'date')));
    const sortedKeys = [...allKeys].sort((a, b) => {
      const sumA = data.reduce((sum, day) => sum + (day[a] || 0), 0);
      const sumB = data.reduce((sum, day) => sum + (day[b] || 0), 0);
      return sumB - sumA;
    }).slice(0, 10);

    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
          <YAxis tickFormatter={formatCurrency} />
          <Tooltip
            formatter={(value) => formatCurrency(value)}
            labelFormatter={(label) => new Date(label).toLocaleDateString()}
          />
          <Legend />
          {sortedKeys.map((key, index) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="1"
              stroke={colors[index % colors.length]}
              fill={colors[index % colors.length]}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

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
          <Col span={12}>
            <h3>Breakdown by Top 10 Clients</h3>
            {renderBreakdownChart(prepareIndividualData(salesData.individualPerformance[selectedSalesPerson], 'clients'), 'clients')}
          </Col>
          <Col span={12}>
            <h3>Breakdown by Top 10 Funds</h3>
            {renderBreakdownChart(prepareIndividualData(salesData.individualPerformance[selectedSalesPerson], 'funds'), 'funds')}
          </Col>
        </Row>
      </Card>
    </div>
  );
}

export default Sales;