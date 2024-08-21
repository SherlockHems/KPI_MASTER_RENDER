import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Dashboard = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const result = await axios.get('/api/dashboard');
      setData(result.data);
    };
    fetchData();
  }, []);

  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Total Income: ${data.total_income.toLocaleString()}</p>
      <p>Top Sales Person: {data.top_sales_person}</p>
      <p>Top Client: {data.top_client}</p>
      <p>Top Fund: {data.top_fund}</p>
    </div>
  );
};

export default Dashboard;