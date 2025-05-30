%Function that reads a cnf file and generate a SAT solution

% INPUT :
% cnffile - Path to the original cnf
% cnffile_new - Path to be provided if the problem is not 3-SAT and does not want to dump the reduced 3-SAT, can pass empty string in such case
% scheme - Scheme to be decided according to user choice, but currently fixed to 1

% OUTPUT : 
% X_final_mcmc - Final SAT solution when runnning the 1-chip MCMC algorithm
% X_final_decomp - Final SAT solution when running the solver-decomposition
% algorithm
% time_mcmc - Time in seconds needed to reach SAT solution for MCMC
% algorithm


tot_time=0;
for i = 1:1
    tic;

    % <50-238
    % cnffile = '/Users/ananyanandy/Documents/ECE_PhD/RESEARCH/FALL_24/DARPA/DARPA_Sets_Jan2024/batch-07/003_2_2.dimacs'; 

    % 50-300
    % cnffile = '/Users/ananyanandy/Documents/ECE_PhD/RESEARCH/FALL_24/DARPA/DARPA_Sets_Jan2024/batch-04/3block-like-rand-00051-0093.cnf';

    cnffile = './000.cnf';

    % cnffile_new = '../cnfs/decomp.cnf';
    cnffile_new = './decomp.cnf';
    scheme =1;
    chip_size=50;

    [file,Clauses,var,nc]= k_sat_read_cnf(cnffile,cnffile_new,scheme);
    [CMat]=generate_cmat(Clauses,var,nc);
    [A,S]=satgraph(CMat,var);

    if (var<=50) && (size(Clauses,1)<=238)

        % No need for decomposition in this case
        [X_final_mcmc,time]= MCMC_SAT(CMat,var,nc);
    elseif (var<=100) && (size(Clauses,1)<=2*238)
        
        start_comb =1; % Starting nodes for decomposition. Maximum possible points [1,2,3,4]

        tic;
        [G_chip1,G_chip2,Clause_set1,Clause_set2,Clause_inter,s_node] = decomposition(start_comb,chip_size,S,A,Clauses);
        decomp_time = toc;

        % [X_final_decomp,sat_time,flip_time,total_time]=chip_solver(s_node,G_chip1,G_chip2,Clause_set1,Clause_set2,Clause_inter,S,Clauses);

        digital_time = decomp_time + sum(flip_time);
        chip_time = sum(sat_time);
    else
        tic;
        [node_set] =  spectral_analysis(A,S,chip_size);
        decomp_time = toc;

        % The number of partitions for large problems
        K = size(node_set,2);

        [Clause_set,Clause_inter,clause_comm_nodes] = clause_split(node_set,K,Clauses);

        [X_final,sat_time,flip_time,total_time]=chip_solver_large(K,node_set,Clause_set,Clause_inter,clause_comm_nodes,S,Clauses);

        digital_time = decomp_time + sum(flip_time);
        chip_time = sum(sat_time);
    end
end

 