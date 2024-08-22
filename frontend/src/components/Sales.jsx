import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, Row, Col, Spin, Alert, Select, Table } from 'antd';
import axios from 'axios';

const { Option } = Select;

function Sales() {
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState(null);

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
      income: Object.values(rawData).reduce((sum, day) => sum + (day[person] || 0), 0)
    }));

    const dailyContribution = Object.entries(rawData).map(([date, incomes]) => ({
      date,
      ...incomes
    }));

    const individualPerformance = {};
    salesPersons.forEach(person => {
      individualPerformance[person] = Object.entries(rawData).map(([date, incomes]) => ({
        date,
        income: incomes[person] || 0
      }));
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
    },
    {
      title: 'Total Income',
      dataIndex: 'income',
      key: 'income',
      render: (text) => formatCurrency(text),
      sorter: (a, b) => a.income - b.income,
    }
  ];

  return (
    <div>
      <h1>Sales Dashboard</h1>
      <Row gutter={16}>
        <Col span={12}>
          <Card title="Income Contribution by Sales Person">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={salesData.salesPersons}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="income" fill="#8884d8" />
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
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={salesData.dailyContribution}>
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
                dot={false}
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
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={salesData.individualPerformance[selectedSalesPerson]}>
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
            <Line type="monotone" dataKey="income" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

export default Sales;