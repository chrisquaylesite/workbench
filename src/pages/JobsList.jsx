import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppState, getJobStatus } from "../state/AppState.jsx";
import TopNav from "../components/TopNav.jsx";
import "./JobsList.css";

const JOBS = [
  {
    id: "GY545476788",
    reg: "SB66HLF",
    inDate: "16 Jan",
    customer: "Mr Tom Jones",
    desc: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=60",
  },
  {
    id: "GY545476789",
    reg: "SB66HLG",
    inDate: "16 Jan",
    customer: "Mr Tom Jones",
    desc: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    img: "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=600&q=60",
  },
  {
    id: "GY545476790",
    reg: "SB66HLH",
    inDate: "16 Jan",
    customer: "Mr Tom Jones",
    desc: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    img: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=600&q=60",
  },
  {
    id: "GY545476791",
    reg: "SB66HLJ",
    inDate: "16 Jan",
    customer: "Mr Tom Jones",
    desc: "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    img: "https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=600&q=60",
    },
];

export default function JobsList() {
  const { state } = useAppState();
  const [query, setQuery] = useState("");

  const jobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return JOBS;
    return JOBS.filter((j) => {
      return (
        j.id.toLowerCase().includes(q) ||
        j.reg.toLowerCase().includes(q) ||
        j.customer.toLowerCase().includes(q)
      );
    });
  }, [query]);

  return (
    <>
      <TopNav />
      <div className="jl">
        <div className="jl__top">
          <div>
            <div className="jl__title">Welcome Chris!</div>
            <div className="jl__sub">There's {JOBS.length} jobs on the lot</div>
          </div>

          <button className="jl__sort" type="button">
            <span className="material-icons">sort</span>
            <span>Sort</span>
          </button>
        </div>

        <div className="jl__searchRow">
          <input
            className="jl__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
          />
          <button className="jl__searchBtn" type="button" aria-label="Search">
            <span className="material-icons">search</span>
          </button>
        </div>

        <div className="jl__list">
          {jobs.map((job) => {
            const status = getJobStatus(state, job.id);

            const chipClass =
              status?.label === "IN PROGRESS"
                ? "jl__chip jl__chip--inprogress"
                : status?.label === "PAUSED"
                ? "jl__chip jl__chip--paused"
                : status?.label === "COMPLETED"
                ? "jl__chip jl__chip--completed"
                : status?.label === "OVERDUE"
                ? "jl__chip jl__chip--overdue"
                : "jl__chip jl__chip--notstarted";

            const chipIcon =
              status?.label === "IN PROGRESS"
                ? "play_arrow"
                : status?.label === "PAUSED"
                ? "pause"
                : status?.label === "COMPLETED"
                ? "check"
                : status?.label === "OVERDUE"
                ? "error"
                : "schedule";

            const chipText =
              status?.label === "IN PROGRESS"
                ? "IN PROGRESS"
                : status?.label === "PAUSED"
                ? "PAUSED"
                : status?.label === "COMPLETED"
                ? "COMPLETED"
                : status?.label === "OVERDUE"
                ? "OVERDUE"
                : "NOT STARTED";

            return (
              <Link key={job.id} to={`/jobs/${job.id}`} className="jl__row">
                <img className="jl__thumbnail" src={job.img} alt="" />
                
                <div className="jl__content">
                  <div className="jl__topLine">
                    <div className="jl__reg">{job.reg}</div>
                    <div className="jl__in">
                      <span className="material-icons">input</span>
                      <span> {job.inDate}</span>
                    </div>
                    <div className={chipClass}>
                  <span className="material-icons">{chipIcon}</span>
                  <span>{chipText}</span>
                </div>
                  </div>

                  <div className="jl__mainLine">
                    <div className="jl__jobId">{job.id}</div>
                    <div className="jl__customer">{job.customer}</div>
                  </div>

                  <div className="jl__desc">{job.desc}</div>
                </div>

               
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}