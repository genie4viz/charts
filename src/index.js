import * as d3 from "d3";
import moment from "moment";
import "./css/styles.css";
import data from "./json/data.json";

const GRAPH_HEIGHT = 800,
  COLORS = {
    seasonal: "#c6333f",
    mostrecent: "#009873",
    avgseasonal: "#3a468d",
    avgoneyear: "#77adda",
    mostrecentquarter: "#e68017",
    total_in: "#5b9ed6",
    total_out: "#283483",
    desc_head: "#1f265c",
    desc_body: "#a2c2e7"
  },
  CIRCLE_SIZE = 5,
  OVER_CIRCLE_SIZE = 8,
  HOT_CIRCLE_SIZE = 12

document.body.appendChild(mainComponent());
init();
//construct index.html
function mainComponent() {
  const container = document.createElement("div");
  container.innerHTML = `
    <div id="charts-container">
      <div id="line-chart-container" class="chart">
        <div id="line-chart-logo">
          <div id="line-chart-title"></div>
          <div id="line-chart-legends"></div>
        </div>
        <div id="line-chart"></div>
      </div>
      <div id="bar-chart-container" class="chart">
        <div id="bar-chart-logo">
          <div id="bar-chart-title"></div>
          <div id="bar-chart-legends"></div>
        </div>
        <div id="bar-chart"></div>
      </div>
      <div id="donut-chart-container" class="chart">
        <div id="donut-chart-wrapper">
          <div id="donut-chart-title"></div>
          <div id="donut-chart"></div>
        </div>
        <div id="donut-chart-legends"></div>
      </div>
    </div>
  `;

  return container;
}

function init() {
  const GRAPH_WIDTH = parseFloat(d3.select(".chart").style("width")) - 20;

  const extra_info = {
      currency_postfix: data.calculation_basis_balances.currency_postfix,
      first_balance: data.calculation_basis_balances.first_balance,
      currency_prefix: data.calculation_basis_balances.currency_prefix,
      main_bank_account_overdraft_limit:
        data.organisation_data.account.data.main_bank_account_overdraft_limit
    },
    f_data = normalizeData(data.calculation_basis_balances.items),
    lines_hot_data = getLinesHotData(
      f_data,
      data.calculation_basis_balances.lines_hot_days
    ),
    bar_hot_data = getBarHotData(
      f_data,
      data.calculation_basis_balances.bar_hot_days,
      "avgoneyear"
    );

  drawLineChart(
    GRAPH_WIDTH,
    GRAPH_HEIGHT,
    f_data,
    extra_info,
    lines_hot_data
  );
  drawBarChart(
    GRAPH_WIDTH,
    GRAPH_HEIGHT,
    f_data,
    "avgoneyear",
    extra_info,
    bar_hot_data
  );
  drawDonutChart(data.contacts);
}

//draw functions

function drawLineChart(cWidth, cHeight, gd, ei, hot_data) {
  //gd: graph data, ei: extra_info

  const margin = { left: 70, top: 25, right: 50, bottom: 180 },
    w = cWidth - margin.left - margin.right,
    h = cHeight - margin.top - margin.bottom,
    svg = d3
      .select("#line-chart")
      .append("svg")
      .attr("id", "svg-line-chart")
      .style("width", cWidth + "px")
      .style("height", cHeight + "px");

  const legend_rows = 2,
    legend_cols = Math.round(gd.length / legend_rows);

  d3.select("#line-chart-title").html(`90 Day Forecast Spread`);

  let legends = gd.map(d => ({ label: d.label, color: COLORS[d.value] }));

  let legend_html_str = `<table>`;
  for (let i = 0; i < legend_cols; i++) {
    legend_html_str += `<tr>`;
    for (let j = 0; j < legend_rows; j++) {
      legend_html_str += `<td>
      <div class="cell1">${
        legends[i * legend_rows + j]
          ? `<svg
        width="20" height="20"
      ><circle cx="10" cy="10" r="5" stroke="${
        legends[i * legend_rows + j].color
      }" stroke-width="3" fill="white"/></svg>`
          : ""
      }${
        legends[i * legend_rows + j] ? legends[i * legend_rows + j].label : ""
      }</div></td>`;
    }
    legend_html_str += `</tr>`;
  }
  legend_html_str += `</table>`;
  d3.select("#line-chart-legends").html(legend_html_str);

  const tooltip = d3
    .select("body")
    .append("div")
    .attr("id", "line-tooltip")
    .attr("class", "tooltip")
    .style("opacity", 0);

  let days = gd[0].data.map(d => d.date),
    available_y_values = [];
  gd.forEach(item => {
    available_y_values.push(...item.data.map(d => d.total));
  });

  //replace data with diff day
  let r_gd = [];

  gd.forEach(d => {
    r_gd.push({
      label: d.label,
      value: d.value,
      data: replaceWithDay(d.data, 1, days)
    });
  });

  const y_max = d3.max(available_y_values),
    y_min = d3.min(available_y_values);

  const svgG = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`),
    x = d3
      .scaleBand()
      .domain(days)
      .range([0, w]),
    y = d3
      .scaleLinear()
      .domain([y_min, y_max])
      .range([h, 0]),
    xAxis = svgG
      .append("g")
      .attr("transform", `translate(0, ${h})`)
      .call(d3.axisBottom(x)),
    yAxis = svgG.append("g").call(d3.axisLeft(y).tickSize(-w));

  xAxis.select(".domain").remove();

  //show skipped days
  const skippedDays = getSkipDays(days, 5);
  xAxis
    .selectAll(".tick")
    .select("text")
    .text(d => (skippedDays.includes(d) ? moment(d).format("MMM DD") : ""));

  xAxis
    .selectAll(".tick")
    .select("line")
    .attr("opacity", 0);

  yAxis
    .append("text")
    .attr("x", -15)
    .attr("y", y(y_max) - 10)
    .attr("fill", "black")
    .attr("font-size", 16)
    .text(ei.currency_prefix);
  yAxis.select(".domain").remove();
  yAxis
    .selectAll(".tick")
    .select("line")
    .attr("stroke", "white");

  yAxis
    .selectAll(".tick")
    .select("text")
    .attr("dx", -5)
    .text(d => (d < 0 ? `(${withComma(Math.abs(d))})` : withComma(d)));

  //indicator line
  const indicator = svgG
    .append("path")
    .attr("class", "indicator")
    .attr("stroke", "grey")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "3, 3");

  // Draw the line
  svgG
    .selectAll(".line")
    .data(r_gd)
    .enter()
    .append("path")
    .attr("fill", "none")
    .attr("stroke", d => COLORS[d.value])
    .style("opacity", (_, i) => (i === 0 ? 1 : 0.5))
    .attr("stroke-width", 1.5)
    .attr("d", d =>
      d3
        .line()
        .x(d => x(d.date) + x.bandwidth() / 2)
        .y(d => y(d.total))(d.data)
    );

  //Draw the circles
  r_gd.forEach((dd, i) => {
    svgG
      .selectAll(`.gen-circle circle-${i}`)
      .data(dd.data)
      .enter()
      .append("circle")
      .attr("class", `gen-circle circle-${i}`)
      .attr("stroke", COLORS[dd.value])
      .attr("stroke-width", 3)
      .style("opacity", i === 0 ? 1 : 0.5)
      .attr("fill", "white")
      .attr("cx", d => x(d.date) + x.bandwidth() / 2)
      .attr("cy", d => y(d.total))
      .attr("r", CIRCLE_SIZE);
  });

  //Draw main_bank_account_overdraft_limit line
  svgG
    .append("path")
    .attr("stroke", "orange")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "3, 3")
    .attr("d", `M0 ${y(ei.main_bank_account_overdraft_limit)}h${w}z`);

  //Append invisible rect for bisect data
  let offsetTop =
      document.getElementById("line-chart-container").offsetTop || 0,
    logo_height = parseFloat(d3.select("#line-chart-logo").style("height"));
  const descG = svgG.append("g");
  svgG
    .append("rect")
    .attr("width", w)
    .attr("height", h)
    .attr("fill", "transparent") //will transparent
    .on("mousemove", function() {
      let date = scaleBandInvert(x)(d3.mouse(this)[0]);

      svgG.selectAll(".gen-circle").each(function() {
        if (d3.select(this).attr("cx") == x(date) + x.bandwidth() / 2) {
          d3.select(this).attr("r", OVER_CIRCLE_SIZE);
        } else {
          d3.select(this).attr("r", CIRCLE_SIZE);
        }
      });

      indicator
        .style("opacity", 1)
        .attr("d", `M${x(date) + x.bandwidth() / 2} 0v${h + 40}`);

      let strInner = getLineChartDataFromDate(gd, date),
        container_width = parseFloat(d3.select(".chart").style("width")),
        tooltip_width = parseFloat(d3.select("#line-tooltip").style("width")),
        scroll_pos = document.getElementById("line-chart").scrollLeft;

      tooltip
        .style("opacity", 1)
        .html(strInner)
        .style("left", () => {
          tooltip_width = parseFloat(d3.select("#line-tooltip").style("width"));
          if (container_width <= 512) {
            return 10 + "px";
          }
          if (d3.event.pageX < container_width / 2) {
            return (
              x(date) + x.bandwidth() / 2 + margin.left - scroll_pos + "px"
            );
          } else {
            return (
              x(date) +
              x.bandwidth() / 2 +
              margin.left -
              scroll_pos -
              tooltip_width +
              "px"
            );
          }
        })
        .style("top", () => {
          if (container_width <= 512) {
            return offsetTop + margin.top + h + 80 + logo_height + "px";
          } else {
            return offsetTop + margin.top + h + 30 + logo_height + "px";
          }
        });

      descG.style("opacity", 0);
    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0);
      descG.style("opacity", 1);
      descG.selectAll("*").remove();
      indicator.style("opacity", 0);
      svg.selectAll(".gen-circle").attr("r", CIRCLE_SIZE);
      drawLimitBreach();
    });

  function drawLimitBreach() {
    let i = 0,
      start_x = 120;
    for (let item in hot_data) {
      descG
        .append("rect")
        .attr("x", start_x + i * 140)
        .attr("y", h + 30)
        .attr("width", 130)
        .attr("height", 120)
        .attr("fill", "#eaecf0")
        .attr("stroke", "#a2c2e7")
        .attr("stroke-width", 1);
      descG
        .append("rect")
        .attr("x", start_x + i * 140)
        .attr("y", h + 30)
        .attr("width", 12)
        .attr("height", 120)
        .attr("fill", "#1f265c")
        .attr("stroke", "#1f265c")
        .attr("stroke-width", 1);
      descG
        .append("circle")
        .attr("class", "hot-circle")
        .attr("cx", start_x + 30 + i * 140)
        .attr("cy", h + 50)
        .attr("r", HOT_CIRCLE_SIZE)
        .attr("fill", COLORS[item])
        .attr("stroke", "white")
        .attr("stroke-width", 5)
        .style("cursor", "pointer");
      descG
        .append("text")
        .attr("x", start_x + 30 + i * 140)
        .attr("y", h + 50)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "white")
        .style("font-size", 14)
        .text(i + 1);

      if (hot_data[item].next_day) {
        descG
          .append("text")
          .attr("x", start_x + 120 + i * 140)
          .attr("y", h + 50)
          .attr("text-anchor", "end")
          .attr("dominant-baseline", "middle")
          .text(`+${hot_data[item].next_day} days`);
      }

      descG
        .append("text")
        .attr("x", start_x + 10 + i * 140 + 10)
        .attr("y", h + 80)
        .text(`Date: ${moment(hot_data[item].date).format("DD-MM-YYYY")}`);

      descG
        .append("text")
        .attr("x", start_x + 10 + i * 140 + 10)
        .attr("y", h + 95)
        .text(hot_data[item].label);

      descG
        .append("text")
        .attr("x", start_x + 10 + i * 140 + 10)
        .attr("y", h + 110)
        .text(
          `Balance: ${
            hot_data[item].total < 0
              ? "(" +
                withComma(Math.round(Math.abs(hot_data[item].total))) +
                ")"
              : withComma(Math.round(hot_data[item].total))
          }`
        );

      descG
        .append("text")
        .attr("x", start_x + 10 + i * 140 + 10)
        .attr("y", h + 125)
        .text(
          `Total In: ${
            hot_data[item].total_in < 0
              ? "(" +
                withComma(Math.round(Math.abs(hot_data[item].total_in))) +
                ")"
              : withComma(Math.round(hot_data[item].total_in))
          }`
        );

      descG
        .append("text")
        .attr("x", start_x + 10 + i * 140 + 10)
        .attr("y", h + 140)
        .text(
          `Total Out: ${
            hot_data[item].total_out < 0
              ? "(" +
                withComma(Math.round(Math.abs(hot_data[item].total_out))) +
                ")"
              : withComma(Math.round(hot_data[item].total_out))
          }`
        );

      i++;
    }
    //breaches
    const breachG = descG.append("g");
    breachG
      .append("path")
      .attr("stroke", "black")
      .attr("stroke-width", 50)
      .attr("fill", "white")
      .attr(
        "d",
        "M990,498.3c0,5.3-1.9,9.8-5.7,13.6L766.6,712.7c-6,5.3-12.7,6.4-19.8,3.4c-7.2-3.4-10.8-8.9-10.8-16.4v-127H28.1c-5.3,0-9.6-1.7-13-5.1c-3.4-3.4-5.1-7.8-5.1-13V445.6c0-5.3,1.7-9.6,5.1-13c3.4-3.4,7.8-5.1,13-5.1h707.8v-127c0-7.9,3.6-13.4,10.8-16.4s13.8-2.1,19.8,2.8l217.8,198.5C988.1,489.1,990,493.4,990,498.3L990,498.3z"
      )
      .attr("transform", `translate(10, ${h + 60})scale(0.06, 0.06)`);
    breachG
      .append("text")
      .attr("x", 0)
      .attr("y", h + 65)
      .text("Limit Breaches");
  }
  drawLimitBreach();
  //Add hot circles
  let i = 0;
  for (let item in hot_data) {
    i++;
    svgG
      .append("circle")
      .attr("class", "hot-circle")
      .attr("cx", x(hot_data[item].date) + x.bandwidth() / 2)
      .attr("cy", y(hot_data[item].total))
      .attr("r", HOT_CIRCLE_SIZE)
      .attr("fill", COLORS[item])
      .attr("stroke", "white")
      .attr("stroke-width", 5)
      .style("cursor", "pointer");
    svgG
      .append("text")
      .attr("class", "hot-circle-text")
      .attr("x", x(hot_data[item].date) + x.bandwidth() / 2)
      .attr("y", y(hot_data[item].total))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "white")
      .style("font-size", 14)
      .style("pointer-events", "none")
      .text(i);
  }
}
function drawBarChart(cWidth, cHeight, gd, duration_name, ei, hot_data) {
  let bgd = gd.filter(d => d.value === duration_name)[0];

  const margin = { left: 70, top: 25, right: 50, bottom: 160 },
    w = cWidth - margin.left - margin.right,
    h = cHeight - margin.top - margin.bottom,
    svg = d3
      .select("#bar-chart")
      .append("svg")
      .style("width", cWidth + "px")
      .style("height", cHeight + "px");

  d3.select("#bar-chart-title").html(
    `${bgd.label} - Predicted<br>cash flow & cash balance`
  );

  let legend_html_str = `<table>
          <tr>
            <td>
              <div class="cell2">
                <svg width="15" height="15"><rect width="15" height="15" fill="${
                  COLORS.total_in
                }"/></svg>&nbsp;Total In
              </div>
            </td>
            <td>
              <div class="cell2">
                <svg width="20" height="20"><circle cx="10" cy="10" r="5" fill="white" stroke-width="3" stroke="${
                  COLORS[bgd.value]
                }"/></svg>&nbsp;${bgd.label}
              </div>
            </td>        
          </tr>
          <tr>
            <td>
              <div class="cell2">
                <svg width="15" height="15"><rect width="15" height="15" fill="${
                  COLORS.total_out
                }"/></svg>&nbsp;Total Out
              </div>
            </td>
          </tr>
        </table>`;

  d3.select("#bar-chart-legends").html(legend_html_str);
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("id", "bar-tooltip")
    .attr("class", "tooltip")
    .style("opacity", 0);

  let days = bgd.data.map(d => d.date),
    available_y_values = [
      ...bgd.data.map(d => d.total),
      ...bgd.data.map(d => d.total_in),
      ...bgd.data.map(d => d.total_out)
    ],
    y_max = d3.max(available_y_values),
    y_min = d3.min(available_y_values),
    //replace data with diff day
    r_bgd = {
      label: bgd.label,
      value: bgd.value,
      data: replaceWithDay(bgd.data, 1, days)
    };

  //show skipped days
  const skippedDays = getSkipDays(days, 5);
  const svgG = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`),
    x = d3
      .scaleBand()
      .domain(days)
      .range([0, w])
      .padding(0.2),
    y = d3
      .scaleLinear()
      .domain([y_min, y_max])
      .range([h, 0]),
    xAxis = svgG
      .append("g")
      .attr("transform", `translate(0, ${h})`)
      .call(d3.axisBottom(x)),
    yAxis = svgG.append("g").call(d3.axisLeft(y).tickSize(-w));

  xAxis.select(".domain").remove();

  xAxis
    .selectAll(".tick")
    .select("text")
    .text(d => (skippedDays.includes(d) ? moment(d).format("MMM DD") : ""));

  xAxis
    .selectAll(".tick")
    .select("line")
    .attr("opacity", 0);

  yAxis.select(".domain").remove();
  yAxis
    .selectAll(".tick")
    .select("line")
    .attr("stroke", "white");

  yAxis
    .append("text")
    .attr("x", -15)
    .attr("y", y(y_max) - 10)
    .attr("fill", "black")
    .attr("font-size", 16)
    .text(ei.currency_prefix);
  yAxis
    .selectAll(".tick")
    .select("text")
    .attr("dx", -5)
    .text(d => (d < 0 ? `(${withComma(Math.abs(d))})` : withComma(d)));

  // Draw bars - total_in
  svgG
    .selectAll(".total_in-bars")
    .data(r_bgd.data)
    .enter()
    .append("rect")
    .attr("fill", COLORS.total_in)
    .attr("x", d => x(d.date))
    .attr("y", d => y(d.total_in))
    .attr("width", x.bandwidth())
    .attr("height", d => y(0) - y(d.total_in));

  // Draw bars - total_out
  svgG
    .selectAll(".total_out-bars")
    .data(r_bgd.data)
    .enter()
    .append("rect")
    .attr("fill", COLORS.total_out)
    .attr("x", d => x(d.date))
    .attr("y", y(0))
    .attr("width", x.bandwidth())
    .attr("height", d => y(d.total_out) - y(0));
  // Draw the line
  svgG
    .selectAll(".line")
    .data([r_bgd])
    .enter()
    .append("path")
    .attr("fill", "none")
    .attr("stroke", d => COLORS[d.value])
    .attr("stroke-width", 1.5)
    .attr("d", d =>
      d3
        .line()
        .x(d => x(d.date) + x.bandwidth() / 2)
        .y(d => y(d.total))(d.data)
    );

  //Draw the circles
  svgG
    .selectAll(".gen-circle")
    .data(r_bgd.data)
    .enter()
    .append("circle")
    .attr("class", "gen-circle")
    .attr("stroke", COLORS[r_bgd.value])
    .attr("stroke-width", 3)
    .attr("fill", "white")
    .attr("cx", d => x(d.date) + x.bandwidth() / 2)
    .attr("cy", d => y(d.total))
    .attr("r", CIRCLE_SIZE);

  //Draw main_bank_account_overdraft_limit line
  svgG
    .append("path")
    .attr("stroke", "orange")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "3, 3")
    .attr("d", `M0 ${y(ei.main_bank_account_overdraft_limit)}h${w}z`);

  //indicator line
  const indicator = svgG
    .append("path")
    .attr("class", "indicator")
    .attr("stroke", "grey")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "3, 3");

  //Append invisible rect for bisect data
  let offsetTop = document.getElementById("bar-chart-container").offsetTop || 0,
    logo_height = parseFloat(d3.select("#bar-chart-logo").style("height"));
  const descG = svgG.append("g");
  svgG
    .append("rect")
    .attr("width", w)
    .attr("height", h)
    .attr("fill", "transparent") //will transparent
    .on("mousemove", function() {
      let date = scaleBandInvert(x)(d3.mouse(this)[0]);

      svg.selectAll(".gen-circle").each(function() {
        if (d3.select(this).attr("cx") == x(date) + x.bandwidth() / 2) {
          d3.select(this).attr("r", OVER_CIRCLE_SIZE);
        } else {
          d3.select(this).attr("r", CIRCLE_SIZE);
        }
      });

      indicator
        .style("opacity", 1)
        .attr("d", `M${x(date) + x.bandwidth() / 2} 0v${h + 40}`);
      let strInner = getBarChartDataFromDate(r_bgd, date); // return htmlStr
      let container_width = parseFloat(d3.select(".chart").style("width")),
        tooltip_width = parseFloat(d3.select("#bar-tooltip").style("width")),
        scroll_pos = document.getElementById("bar-chart").scrollLeft;

      tooltip
        .style("opacity", 1)
        .html(strInner)
        .style("left", () => {
          tooltip_width = parseFloat(d3.select("#bar-tooltip").style("width"));
          if (d3.event.pageX < container_width / 2) {
            return (
              x(date) + x.bandwidth() / 2 + margin.left - scroll_pos + "px"
            );
          } else {
            return (
              x(date) +
              x.bandwidth() / 2 +
              margin.left -
              scroll_pos -
              tooltip_width +
              "px"
            );
          }
        })
        .style("top", () => {
          if (container_width <= 512) {
            return offsetTop + margin.top + h + 150 + logo_height + "px";
          } else {
            return offsetTop + margin.top + h + 30 + logo_height + "px";
          }
        });
      descG.style("opacity", 0);
    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0);
      indicator.style("opacity", 0);
      svg.selectAll(".gen-circle").attr("r", CIRCLE_SIZE);
      drawLimitBreach();
    });
  function drawLimitBreach() {
    descG.style("opacity", 1);
    descG.selectAll("*").remove();
    let i = 0,
      start_x = 120;
    for (let item of hot_data) {
      descG
        .append("rect")
        .attr("x", start_x + i * 140)
        .attr("y", h + 30)
        .attr("width", 130)
        .attr("height", 110)
        .attr("fill", "#eaecf0")
        .attr("stroke", "#a2c2e7")
        .attr("stroke-width", 1);
      descG
        .append("rect")
        .attr("x", start_x + i * 140)
        .attr("y", h + 30)
        .attr("width", 12)
        .attr("height", 110)
        .attr("fill", "#1f265c")
        .attr("stroke", "#1f265c")
        .attr("stroke-width", 1);
      descG
        .append("circle")
        .attr("class", "hot-circle")
        .attr("cx", start_x + 30 + i * 140)
        .attr("cy", h + 50)
        .attr("r", HOT_CIRCLE_SIZE)
        .attr("fill", COLORS[duration_name])
        .attr("stroke", "white")
        .attr("stroke-width", 5)
        .style("cursor", "pointer");
      descG
        .append("text")
        .attr("x", start_x + 30 + i * 140)
        .attr("y", h + 50)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "white")
        .style("font-size", 14)
        .text(i + 1);

      if (item.next_day) {
        descG
          .append("text")
          .attr("x", start_x + 120 + i * 140)
          .attr("y", h + 50)
          .attr("text-anchor", "end")
          .attr("dominant-baseline", "middle")
          .text(`+${item.next_day} days`);
      }

      descG
        .append("text")
        .attr("x", start_x + 10 + i * 140 + 10)
        .attr("y", h + 80)
        .text(`Date: ${moment(item.date).format("DD-MM-YYYY")}`);

      descG
        .append("text")
        .attr("x", start_x + 10 + i * 140 + 10)
        .attr("y", h + 95)
        .text(
          `Balance: ${
            item.total < 0
              ? "(" + withComma(Math.round(Math.abs(item.total))) + ")"
              : withComma(Math.round(item.total))
          }`
        );

      descG
        .append("text")
        .attr("x", start_x + 10 + i * 140 + 10)
        .attr("y", h + 110)
        .text(
          `Total In: ${
            item.total_in < 0
              ? "(" + withComma(Math.round(Math.abs(item.total_in))) + ")"
              : withComma(Math.round(item.total_in))
          }`
        );

      descG
        .append("text")
        .attr("x", start_x + 10 + i * 140 + 10)
        .attr("y", h + 125)
        .text(
          `Total Out: ${
            item.total_out < 0
              ? "(" + withComma(Math.round(Math.abs(item.total_out))) + ")"
              : withComma(Math.round(item.total_out))
          }`
        );
      i++;
    }
    //breaches
    const breachG = descG.append("g");
    breachG
      .append("path")
      .attr("stroke", "black")
      .attr("stroke-width", 50)
      .attr("fill", "white")
      .attr(
        "d",
        "M990,498.3c0,5.3-1.9,9.8-5.7,13.6L766.6,712.7c-6,5.3-12.7,6.4-19.8,3.4c-7.2-3.4-10.8-8.9-10.8-16.4v-127H28.1c-5.3,0-9.6-1.7-13-5.1c-3.4-3.4-5.1-7.8-5.1-13V445.6c0-5.3,1.7-9.6,5.1-13c3.4-3.4,7.8-5.1,13-5.1h707.8v-127c0-7.9,3.6-13.4,10.8-16.4s13.8-2.1,19.8,2.8l217.8,198.5C988.1,489.1,990,493.4,990,498.3L990,498.3z"
      )
      .attr("transform", `translate(10, ${h + 60})scale(0.06, 0.06)`);
    breachG
      .append("text")
      .attr("x", 0)
      .attr("y", h + 65)
      .text("Limit Breaches");
  }
  drawLimitBreach();
  //Add hot circles
  console.log(hot_data, "hot_data");
  let i = 0;
  for (let item of hot_data) {
    i++;
    svgG
      .append("circle")
      .attr("class", "hot-circle")
      .attr("cx", x(item.date) + x.bandwidth() / 2)
      .attr("cy", y(item.total))
      .attr("r", HOT_CIRCLE_SIZE)
      .attr("fill", COLORS[duration_name])
      .attr("stroke", "white")
      .attr("stroke-width", 5)
      .style("cursor", "pointer");
    svgG
      .append("text")
      .attr("class", "hot-circle-text")
      .attr("x", x(item.date) + x.bandwidth() / 2)
      .attr("y", y(item.total))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "white")
      .style("font-size", 14)
      .style("pointer-events", "none")
      .text(i);
  }
}
function drawDonutChart(gd) {
  //add title
  document.getElementById("donut-chart-title").innerHTML = "Donut Chart";

  const colors = d3
    .scaleSequential()
    .domain([1, gd.length])
    .interpolator(d3.interpolateViridis);

  const margin = 40,
    cWidth = 450,
    svg = d3
      .select("#donut-chart")
      .append("svg")
      .style("width", cWidth + "px")
      .style("height", cWidth + "px");

  svg.selectAll("*").remove();
  //add legends
  const rows = 4,
    cols = Math.round(gd.length / rows);
  let legend_html_str = `<table>`;
  for (let i = 0; i < cols; i++) {
    legend_html_str += `<tr>`;
    for (let j = 0; j < rows; j++) {
      legend_html_str += `<td>
          <div class='cell1'>
            <svg width="15px" height="15px"><rect width="15px" height="15px" fill="${colors(
              i * rows + j
            )}"/>
            </svg>&nbsp;<span class="span-text">${gd[i * rows + j].contact.name}</span>
          </div>
        </td>`;
    }
    legend_html_str += `</tr>`;
  }
  legend_html_str += `</table>`;
  document.getElementById("donut-chart-legends").innerHTML = legend_html_str;

  const radius = (cWidth - margin) / 2;
  const svgG = svg
    .append("g")
    .attr("transform", `translate(${cWidth / 2}, ${cWidth / 2})`);

  const pie = d3.pie().value(d => Math.abs(parseFloat(d.contact.known_total)));
  const data_ready = pie(gd);
  const total = d3.sum([
    ...gd.map(d => Math.abs(parseFloat(d.contact.known_total)))
  ]);

  //append description text in center of chart
  const descNameTxt = svgG
    .append("text")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .text("Total");
  const descValueTxt = svgG
    .append("text")
    .attr("y", 18)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .text(withComma(Math.abs(parseFloat(total))));
  svgG
    .selectAll("pie")
    .data(data_ready)
    .enter()
    .append("path")
    .attr(
      "d",
      d3
        .arc()
        .innerRadius(radius * 0.4) // This is the size of the donut hole
        .outerRadius(radius)
    )
    .attr("fill", (_, i) => colors(i))
    .attr("stroke", "white")
    .style("stroke-width", 1)
    .style("opacity", 0.6)
    .on("mouseover", function(d) {
      d3.select(this).style("opacity", 1);
      descNameTxt.text(d.data.contact.name);
      descValueTxt.text(
        withComma(Math.abs(parseFloat(d.data.contact.known_total)))
      );
    })
    .on("mouseout", function() {
      d3.select(this).style("opacity", 0.6);
      descNameTxt.text("Total");
      descValueTxt.text(withComma(Math.abs(parseFloat(total))));
    });
}

//util functions

//data format functions
function normalizeData(data) {
  const all_days = getDays(data);
  let c_data = [];

  for (let item in data) {
    c_data.push({
      data: data[item].items.data,
      label: data[item].label,
      value: item
    });
  }

  for (let item in c_data) {
    const days = c_data[item].data.map(d => d.date);
    for (let day of all_days) {
      if (!days.includes(day)) {
        c_data[item].data.push({ date: day });
      }
    }
    c_data[item].data.sort((a, b) => new Date(a.date) - new Date(b.date));

    c_data[item].data = replaceData(c_data[item].data);
  }
  return c_data;
}
//replace empty data as previous day's data

function replaceData(data) {
  let r_data = [...data];
  for (let i = 0; i < r_data.length; i++) {
    if (!r_data[i].total) {
      if (r_data[i - 1] && r_data[i - 1].total) {
        r_data[i].total = r_data[i - 1].total;
      } else {
        r_data[i].total = 0;
      }
    }
    if (!r_data[i].total_in) {
      r_data[i].total_in = 0;
    }
    if (!r_data[i].total_out) {
      r_data[i].total_out = 0;
    }
  }
  return r_data;
}
function scaleBandInvert(scale) {
  let domain = scale.domain();
  let paddingOuter = scale(domain[0]);
  let eachBand = scale.step();
  return function(value) {
    let index = Math.floor((value - paddingOuter) / eachBand);
    return domain[Math.max(0, Math.min(index, domain.length - 1))];
  };
}
//getting hot datas
function getLinesHotData(f_data, hot_days) {
  let hot = {};

  for (let day of hot_days) {
    let current = f_data.filter(d => d.value === day.item_type)[0];
    hot[day.item_type] = current.data.filter(d => d.date === day.date)[0];
    hot[day.item_type].label = current.label;
    hot[day.item_type].next_day = day.next_day || "";
  }

  return hot;
}

function getBarHotData(f_data, hot_days, item_type) {
  let hot_arr = [],
    hot = {},
    selected_data,
    current;
  selected_data = f_data.filter(d => d.value === item_type)[0];

  for (let item of hot_days[item_type].items) {
    hot = {};
    current = selected_data.data.filter(d => d.date === item.date)[0];
    hot = current;
    hot.next_day = item.next_day || "";
    hot_arr.push(hot);
  }
  return hot_arr;
}
//get info from any date
function getLineChartDataFromDate(data, strDate) {
  let strHtml = "",
    current;
  strHtml += `<b class="b-date">Date: ${moment(strDate).format(
    "DD-MM-YYYY"
  )}</b>`;
  strHtml += `<div class='tip-content'>`;
  for (let item of data) {
    strHtml += `<div class='tip-content-row'>`;
    current = item.data.filter(d => d.date === strDate)[0];
    strHtml += `<b>${item.label}</b>`;
    strHtml += `Balance: ${
      current.total < 0
        ? "(" + withComma(Math.round(Math.abs(current.total))) + ")"
        : withComma(Math.round(current.total))
    }<br/>`;
    strHtml += `Total In: ${
      current.total_in < 0
        ? "(" + withComma(Math.round(Math.abs(current.total_in))) + ")"
        : withComma(Math.round(current.total_in))
    }<br/>`;
    strHtml += `Total Out: ${
      current.total_out < 0
        ? "(" + withComma(Math.round(Math.abs(current.total_out))) + ")"
        : withComma(Math.round(current.total_out))
    }<br/>`;
    strHtml += `</div>`;
  }
  strHtml += `</div>`;
  return strHtml;
}
function getBarChartDataFromDate(data, strDate) {
  let strHtml = "",
    current;
  strHtml += `<b class="b-date">Date: ${moment(strDate).format(
    "DD-MM-YYYY"
  )}</b>`;
  strHtml += `<div class='tip-content'>`;
  strHtml += `<div class='tip-content-row'>`;
  current = data.data.filter(d => d.date === strDate)[0];
  strHtml += `<b>${data.label}</b>`;
  strHtml += `Balance: ${
    current.total < 0
      ? "(" + withComma(Math.round(Math.abs(current.total))) + ")"
      : withComma(Math.round(current.total))
  }<br/>`;
  strHtml += `Total In: ${
    current.total_in < 0
      ? "(" + withComma(Math.round(Math.abs(current.total_in))) + ")"
      : withComma(Math.round(current.total_in))
  }<br/>`;
  strHtml += `Total Out: ${
    current.total_out < 0
      ? "(" + withComma(Math.round(Math.abs(current.total_out))) + ")"
      : withComma(Math.round(current.total_out))
  }<br/>`;
  strHtml += `</div>`;
  strHtml += `</div>`;
  return strHtml;
}
//replace data with diff step
// function replaceWithDiff(data, key_name, diff_step) {
//   let replaced = [data[0]],
//     current = data[0][key_name];
//   for (let i = 1; i < data.length; i++) {
//     if (Math.abs(current - data[i][key_name]) >= diff_step) {
//       replaced.push(data[i]);
//       current = data[i][key_name];
//     } else {
//       // replaced.push({ ...data[i], [key_name]: current });
//     }
//   }
//   return replaced;
// }

//replace data with day step
function replaceWithDay(data, day_step, days) {
  let replaced = [],
    sel_days = getSkipDays(days, day_step);

  for (let i = 0; i < data.length; i++) {
    if (sel_days.includes(data[i].date)) {
      replaced.push(data[i]);
    }
  }
  return replaced;
}

//date relation functions
function generateDays(startDate, endDate) {
  let now = startDate,
    dates = [];

  while (now.isSameOrBefore(endDate)) {
    dates.push(now.format("YYYY-MM-DD").toString());
    now.add(1, "days");
  }
  return dates;
}
function getSkipDays(days, step) {
  let sel_days = [];

  for (let i = 0; i < days.length; i += step) {
    sel_days.push(days[i]);
  }
  if (days.length - (1 % step) !== 0) {
    sel_days.push(days[days.length - 1]);
  }
  return sel_days;
}
function getDays(data) {
  let dates_arr = [];
  for (let item in data) {
    dates_arr.push(...data[item].items.dates);
  }
  return generateDays(moment(d3.min(dates_arr)), moment(d3.max(dates_arr)));
}
function withComma(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
