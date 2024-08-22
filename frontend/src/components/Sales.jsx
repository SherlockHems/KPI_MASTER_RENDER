import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, Row, Col, Spin, Alert, Select, Table, Radio } from 'antd';
import axios from 'axios';
import PropTypes from 'prop-types';

const { Option } = Select;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }

    return this.props.children;
  }
}

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

      setSalesData(response.data);
      if (response.data.salesPersons.length > 0) {
        setSelectedSalesPerson(response.data.salesPersons[0].name);
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
    salesData.salesPersons.forEach(person => {
      newDay[person.name] = (prevDay[person.name] || 0) + (day[person.name] || 0);
    });
    acc.push(newDay);
    return acc;
  }, []);

  const renderBreakdownChart = (data, dataKey) => (
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
        {Object.keys(data[0][dataKey]).map((key, index) => (
          <Area
            key={key}
            type="monotone"
            dataKey={`${dataKey}.${key}`}
            stackId="1"
            stroke={colors[index % colors.length]}
            fill={colors[index % colors.length]}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );

  return (
    <ErrorBoundary>
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
              <h3>Breakdown by Clients</h3>
              {renderBreakdownChart(salesData.individualPerformance[selectedSalesPerson], 'clients')}
            </Col>
            <Col span={12}>
              <h3>Breakdown by Funds</h3>
              {renderBreakdownChart(salesData.individualPerformance[selectedSalesPerson], 'funds')}
            </Col>
          </Row>
        </Card>
      </div>
    </ErrorBoundary>
  );
}

Sales.propTypes = {
  searchTerm: PropTypes.string
};

export default Sales;